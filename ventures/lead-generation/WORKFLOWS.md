# Workflows

## `leadgen.route_inbound` — draft, autonomy level 3

Trigger: `lead.created` where venture is lead-generation **and status is
`qualified`**. Idempotency: `leadId`. Kill switch: `killswitch.lead_routing`.

| Step | Action | Notes |
| --- | --- | --- |
| `tag_service` | `record.tag` | Tags with the service type |
| `notify_buyer` | `email.send` | Transactional; 2 retries, then the failure queue |
| `acceptance_task` | `task.create` | Tracks the 24-hour window |

**Billing is deliberately not in this workflow.** Charging for a lead the buyer
may dispute within 24 hours is a `payment.charge` action, which is high risk and
belongs behind an approval. Invoicing happens after the acceptance window.

Level 3 is appropriate because every step is reversible and the only outbound
message is a transactional notification to a buyer who asked for it.

## Buyer routing

`routeLead()` in `src/routing.ts`. Eligibility, in order:

1. Buyer is active
2. Buyer is not paused (billing or quality hold)
3. Buys this service type
4. Covers this postal code
5. Has not hit their daily capacity

Then selection:

- **Exclusive territory holders win outright** — that is what they paid for
- Otherwise **rotation**: longest time since their last lead, with acceptance
  rate breaking ties

Every rejected buyer is returned **with a reason**, so "why didn't I get that
one?" has an answer. That answer is worth more to buyer trust than most of the
rest of the system.

If no buyer is eligible, the lead stays unrouted rather than going to someone
who cannot serve it.

## Disputes

`assessDispute()`:

| Situation | Outcome |
| --- | --- |
| Raised outside the 24-hour window | Declined, with the elapsed time stated |
| Buyer's dispute rate above 40% | To a human — a relationship problem, not a credit decision |
| Duplicate, wrong service, outside area, invalid contact, spam | **Auto-credited** — verifiable from our own records |
| Anything subjective | To a human reviewer |

Auto-crediting objective reasons matters commercially: a buyer who has to argue
for an obviously bad lead leaves, whatever the eventual outcome.

## Scoring

`ROOFING_SCORING_MODEL` (max 100, qualified at 55):

| Signal | Points |
| --- | --- |
| Property owner | +25 |
| Renter | **disqualified** |
| Phone supplied | +20 |
| Postal code supplied | +10 |
| Describes a roofing need | +25 |
| Insurance claim in progress | +15 |
| Wants work within 30 days | +15 |
| Price research only, no timeline | −20 |
| Solicitation (selling, recruiting, partnership) | **disqualified** |

## Not built

Landing page generation, call tracking, buyer portal, invoicing after the
acceptance window, and territory management UI.
