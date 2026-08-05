# Sample data

Fictional demo data lives in `packages/demo-data`, not here, so that the seed
CLI and the Command Center's in-memory mode show exactly the same world.

Run it with `pnpm seed`.

Everything in it is invented. Domains use `.invalid`, which RFC 2606 reserves
and guarantees will never resolve, and phone numbers use the 555 range. No
company or person in the seed data corresponds to a real one.

The seeded world:

- Northbridge Holdings, one holding organization
- Three ventures: automation-agency (launched), ai-visibility (validation),
  lead-generation (idea)
- Four fictional contractor companies as accounts and leads
- Budgets, plans, a subscription, cost entries and two metric snapshots
- One approved knowledge document
- One running experiment with a real end date and loss cap
- One approval waiting for the owner
