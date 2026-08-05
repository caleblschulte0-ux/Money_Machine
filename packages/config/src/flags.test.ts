import { describe, expect, it } from "vitest";
import { FlagRegistry } from "./flags.ts";

const at = new Date("2026-03-01T00:00:00Z");

describe("FlagRegistry", () => {
  it("returns false for unknown flags so a typo cannot enable anything", () => {
    const registry = new FlagRegistry();
    expect(registry.isEnabled("feature.does_not_exist")).toBe(false);
  });

  it("ships kill switches off and outbound SMS off", () => {
    const registry = new FlagRegistry();
    expect(registry.isEnabled("killswitch.all_automation")).toBe(false);
    expect(registry.isEnabled("feature.outbound_sms")).toBe(false);
    expect(registry.isEnabled("feature.billing_charges")).toBe(false);
  });

  it("requires a reason for every override", () => {
    const registry = new FlagRegistry();
    expect(() =>
      registry.setOverride({
        key: "feature.outbound_sms",
        value: true,
        reason: "  ",
        setBy: "owner",
        setAt: at,
      }),
    ).toThrow(/reason/);
  });

  it("refuses to override an unknown flag", () => {
    const registry = new FlagRegistry();
    expect(() =>
      registry.setOverride({
        key: "feature.typo",
        value: true,
        reason: "testing",
        setBy: "owner",
        setAt: at,
      }),
    ).toThrow(/unknown flag/);
  });

  it("prefers the most specific override", () => {
    const registry = new FlagRegistry();
    registry.setOverride({
      key: "feature.outbound_sms",
      value: true,
      organizationId: "org_1",
      reason: "org-wide pilot",
      setBy: "owner",
      setAt: at,
    });
    registry.setOverride({
      key: "feature.outbound_sms",
      value: false,
      organizationId: "org_1",
      ventureId: "vnt_1",
      reason: "this venture is not ready",
      setBy: "owner",
      setAt: at,
    });

    expect(registry.isEnabled("feature.outbound_sms", { organizationId: "org_1" })).toBe(true);
    expect(
      registry.isEnabled("feature.outbound_sms", { organizationId: "org_1", ventureId: "vnt_1" }),
    ).toBe(false);
    // A different organization sees the shipped default.
    expect(registry.isEnabled("feature.outbound_sms", { organizationId: "org_2" })).toBe(false);
  });

  it("reports automation as stopped when the global kill switch is pulled", () => {
    const registry = new FlagRegistry();
    expect(registry.automationStopped()).toBe(false);
    registry.setOverride({
      key: "killswitch.all_automation",
      value: true,
      reason: "incident 2026-03-01",
      setBy: "owner",
      setAt: at,
    });
    expect(registry.automationStopped()).toBe(true);
  });

  it("refuses a redefinition that changes ownership", () => {
    const registry = new FlagRegistry();
    expect(() =>
      registry.define({
        key: "killswitch.all_automation",
        description: "hijacked",
        defaultValue: false,
        status: "stable",
        owner: "someone-else",
      }),
    ).toThrow(/already defined/);
  });
});
