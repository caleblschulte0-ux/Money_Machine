import {
  errors,
  newCorrelationId,
  newId,
  systemClock,
  type Clock,
  type TenantScope,
} from "@holdco/core";
import type { Membership, Organization, RoleKey, Session, Store, User } from "@holdco/database";
import {
  MemoryRateLimiter,
  RATE_LIMITS,
  digestToken,
  hashPassword,
  issueToken,
  verifyPassword,
  type RateLimiter,
} from "@holdco/security";
import { AUDIT_ACTIONS, AuditLog } from "@holdco/audit";
import { permissionsForRoles, type AuthorizedScope } from "./rbac.ts";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface RegisterOrganizationInput {
  name: string;
  slug: string;
  kind?: Organization["kind"];
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
}

export interface LoginInput {
  organizationId: string;
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginSuccess {
  user: User;
  session: Session;
  /** Returned once. Only its digest is stored. */
  sessionToken: string;
  scope: AuthorizedScope;
}

export class AuthService {
  private readonly loginLimiter: RateLimiter;

  constructor(
    private readonly store: Store,
    private readonly audit: AuditLog,
    private readonly clock: Clock = systemClock,
    loginLimiter?: RateLimiter,
  ) {
    this.loginLimiter =
      loginLimiter ?? new MemoryRateLimiter(RATE_LIMITS.login, () => this.clock.epochMillis());
  }

  async registerOrganization(input: RegisterOrganizationInput): Promise<{
    organization: Organization;
    owner: User;
  }> {
    const existing = await this.store.organizations.findFirst({ where: { slug: input.slug } });
    if (existing) throw errors.conflict("An organization with that slug already exists");

    const now = this.clock.now();
    const organization = await this.store.organizations.create({
      id: newId("org", now.getTime()),
      name: input.name,
      slug: input.slug,
      kind: input.kind ?? "customer",
      status: "active",
      metadata: {},
    });

    const owner = await this.createUser({
      organizationId: organization.id,
      email: input.ownerEmail,
      name: input.ownerName,
      password: input.ownerPassword,
      role: "owner",
    });

    return { organization, owner };
  }

  async createUser(input: {
    organizationId: string;
    email: string;
    name: string;
    password?: string;
    role: RoleKey;
    ventureIds?: string[] | null;
  }): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const duplicate = await this.store.users.findFirst({
      where: { organizationId: input.organizationId, email },
    });
    if (duplicate) throw errors.conflict("A user with that email already exists in this organization");

    const now = this.clock.now();
    const user = await this.store.users.create({
      id: newId("usr", now.getTime()),
      organizationId: input.organizationId,
      email,
      name: input.name,
      passwordHash: input.password ? await hashPassword(input.password) : null,
      status: input.password ? "active" : "invited",
      mfaEnrolled: false,
      lastLoginAt: null,
    });

    await this.grantMembership({
      organizationId: input.organizationId,
      userId: user.id,
      role: input.role,
      ventureIds: input.ventureIds ?? null,
      grantedBy: "system",
    });

    return user;
  }

  async grantMembership(input: {
    organizationId: string;
    userId: string;
    role: RoleKey;
    ventureIds: string[] | null;
    grantedBy: string;
  }): Promise<Membership> {
    const membership = await this.store.memberships.create({
      id: newId("mem", this.clock.epochMillis()),
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role,
      ventureIds: input.ventureIds,
      status: "active",
    });

    await this.audit.record({
      scope: { organizationId: input.organizationId },
      action: AUDIT_ACTIONS.membershipGranted,
      entityType: "membership",
      entityId: membership.id,
      actor: { type: "system", id: input.grantedBy },
      summary: `Granted role "${input.role}" to user ${input.userId}`,
      after: { role: input.role, ventureIds: input.ventureIds },
    });

    return membership;
  }

  async revokeMembership(membershipId: string, revokedBy: string): Promise<void> {
    const membership = await this.store.memberships.require(membershipId);
    await this.store.memberships.update(membershipId, { status: "revoked" });
    await this.audit.record({
      scope: { organizationId: membership.organizationId },
      action: AUDIT_ACTIONS.membershipRevoked,
      entityType: "membership",
      entityId: membershipId,
      actor: { type: "human", id: revokedBy },
      summary: `Revoked role "${membership.role}" from user ${membership.userId}`,
      before: { role: membership.role, status: membership.status },
    });
  }

  async login(input: LoginInput): Promise<LoginSuccess> {
    const email = input.email.trim().toLowerCase();
    const limiterKey = `${input.organizationId}:${email}`;
    const decision = this.loginLimiter.consume(limiterKey);
    if (!decision.allowed) {
      throw new (await import("@holdco/core")).AppError(
        "rate_limited",
        "Too many login attempts. Try again later.",
        { retryAfterMs: decision.retryAfterMs },
      );
    }

    const user = await this.store.users.findFirst({
      where: { organizationId: input.organizationId, email },
    });

    // Same failure for "no such user" and "wrong password" — no enumeration.
    const failed = async (reason: string): Promise<never> => {
      await this.audit.record({
        scope: { organizationId: input.organizationId },
        action: AUDIT_ACTIONS.userLoginFailed,
        entityType: "user",
        entityId: user?.id ?? null,
        actor: { type: "system" },
        summary: `Failed login for ${email}`,
        metadata: { reason },
        ipAddress: input.ipAddress ?? null,
      });
      throw errors.unauthenticated("Invalid email or password");
    };

    if (!user || !user.passwordHash) return failed("no_password_set");
    if (user.status !== "active") return failed("user_not_active");
    if (!(await verifyPassword(input.password, user.passwordHash))) return failed("bad_password");

    this.loginLimiter.reset(limiterKey);
    const now = this.clock.now();
    const token = issueToken("sess");
    const session = await this.store.sessions.create({
      id: newId("ses", now.getTime()),
      organizationId: user.organizationId,
      userId: user.id,
      tokenDigest: token.digest,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      revokedAt: null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      mfaSatisfied: !user.mfaEnrolled,
    });

    await this.store.users.update(user.id, { lastLoginAt: now });
    await this.audit.record({
      scope: { organizationId: user.organizationId },
      action: AUDIT_ACTIONS.userLogin,
      entityType: "user",
      entityId: user.id,
      actor: { type: "human", id: user.id, label: user.name },
      summary: `${user.email} signed in`,
      ipAddress: input.ipAddress ?? null,
    });

    return {
      user,
      session,
      sessionToken: token.plaintext,
      scope: await this.scopeForUser(user),
    };
  }

  async authenticate(sessionToken: string): Promise<AuthorizedScope> {
    const session = await this.store.sessions.findFirst({
      where: { tokenDigest: digestToken(sessionToken) },
    });
    if (!session) throw errors.unauthenticated("Session not found");
    if (session.revokedAt) throw errors.unauthenticated("Session revoked");
    if (session.expiresAt.getTime() <= this.clock.epochMillis()) {
      throw errors.unauthenticated("Session expired");
    }
    const user = await this.store.users.require(session.userId);
    if (user.status !== "active") throw errors.unauthenticated("User is not active");
    if (user.mfaEnrolled && !session.mfaSatisfied) {
      throw errors.unauthenticated("Multi-factor authentication is required for this session");
    }
    return this.scopeForUser(user);
  }

  async logout(sessionToken: string): Promise<void> {
    const session = await this.store.sessions.findFirst({
      where: { tokenDigest: digestToken(sessionToken) },
    });
    if (!session) return;
    await this.store.sessions.update(session.id, { revokedAt: this.clock.now() });
    await this.audit.record({
      scope: { organizationId: session.organizationId },
      action: AUDIT_ACTIONS.userLogout,
      entityType: "session",
      entityId: session.id,
      actor: { type: "human", id: session.userId },
      summary: "Signed out",
    });
  }

  /** Build the scope an actor carries for the rest of a request. */
  async scopeForUser(user: User): Promise<AuthorizedScope> {
    const memberships = await this.store.memberships.all({
      where: { organizationId: user.organizationId, userId: user.id, status: "active" },
    });
    if (memberships.length === 0) {
      throw errors.forbidden("User has no active membership in this organization");
    }
    const roles = memberships.map((m) => m.role);
    const ventureScope = memberships.some((m) => m.ventureIds === null)
      ? ("all" as const)
      : [...new Set(memberships.flatMap((m) => m.ventureIds ?? []))];

    return {
      organizationId: user.organizationId,
      userId: user.id,
      ventureScope,
      correlationId: newCorrelationId(),
      roles,
      permissions: permissionsForRoles(roles),
    };
  }

  /**
   * The scope an agent run carries. Always the narrow `agent` role, always
   * pinned to a single venture, and it records the run id so every write the
   * agent makes is attributable.
   */
  agentScope(organizationId: string, ventureId: string, agentRunId: string): AuthorizedScope {
    return {
      organizationId,
      ventureScope: [ventureId],
      agentRunId,
      correlationId: newCorrelationId(),
      roles: ["agent"],
      permissions: permissionsForRoles(["agent"]),
    };
  }

  /** Purge expired sessions. Called by the worker's maintenance job. */
  async pruneSessions(organizationId: string): Promise<number> {
    const expired = await this.store.sessions.all({
      where: { organizationId, expiresAt: { lt: this.clock.now() } },
    });
    for (const session of expired) await this.store.sessions.delete(session.id);
    return expired.length;
  }
}

export type { TenantScope };
