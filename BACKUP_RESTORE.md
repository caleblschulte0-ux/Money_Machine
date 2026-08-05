# Backup and restore

**Status: not implemented.** No production database exists, no backups are
configured, and no restore has ever been tested. This is the intended
procedure.

## What must be backed up

| Data | Why |
| --- | --- |
| PostgreSQL | Everything. All 41 collections. |
| Secrets | `SESSION_SECRET`, `FIELD_ENCRYPTION_KEY`. **Losing the encryption key makes encrypted fields unrecoverable.** |
| Object storage | Not yet used; will hold documents |

The in-memory store is not backed up because it is not persistence. It is
rejected in production by the config layer.

## Intended policy

- Automated daily full backups, retained 30 days
- Point-in-time recovery for 7 days
- Encrypted at rest, in a different failure domain from the primary
- Secrets in a managed secret store with its own versioning and recovery

## Restore procedure

1. Stop the application. Pull `killswitch.all_automation` first so nothing acts
   on partially restored data.
2. Provision a fresh database.
3. Restore the snapshot.
4. Verify **before** pointing production at it:
   - Row counts against the expected order of magnitude
   - The most recent audit event's timestamp against the incident window
   - An encrypted field decrypts with the current key
   - `pnpm typecheck` passes against the restored schema
5. Point the application at it and start.
6. Clear the kill switch, and watch workflow runs for a cycle.

## Restore testing

A backup that has never been restored is a hypothesis.

Intended cadence: quarterly, restoring into a scratch environment and running
the verification steps above. **This has never been done.** It should be part of
the pre-deployment checklist in `docs/DEPLOYMENT.md`.

## The encryption key

`FIELD_ENCRYPTION_KEY` is not recoverable from the database — that is the point
of it. If it is lost, every AES-256-GCM encrypted field is permanently
unreadable. It must be backed up separately from the database, and rotating it
requires re-encrypting existing values.
