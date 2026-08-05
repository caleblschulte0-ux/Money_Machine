# Customer

There are two customers, and confusing them is how lead-gen businesses fail.

## The buyer (pays us)

A roofing contractor, 5–50 employees, in one metro. Owner-operated or with a
sales manager. Already buys leads — from Angi, from a competitor, or from a
marketing agency — and has opinions about all of them.

**What they want:** exclusivity, speed, and someone who credits a bad lead
without an argument.

**What they say:**
- "I got the same lead as three other guys."
- "Half of them are renters."
- "By the time I called they'd already booked someone."
- "I asked for a credit and they gave me the runaround."

Every one of those is a product requirement, and each maps to something in the
code: exclusivity is enforced in `routeLead()`, speed is why the notification
step retries and queues on failure, renters are disqualified in the scoring
model, and objective dispute reasons are auto-credited without a human argument.

**What loses them:** duplicates, disputes handled badly, and volume promises
that are not met. Notably not the price.

## The enquirer (does not pay us)

A homeowner with a leak, storm damage, or a roof at the end of its life. They
filled in a form or called a tracked number. They expect to hear from a
contractor quickly, and they expect their information to be handled properly.

**They are not the product.** They are a person with a problem, and the form
must disclose plainly that their enquiry will be shared with a service
provider. A lead business that treats enquirers as inventory generates
complaints, which generates suppression entries and regulatory attention.

## Who does not buy

| Not a fit | Why |
| --- | --- |
| Contractors with no capacity | Leads they cannot serve create complaints |
| Anyone wanting non-exclusive volume | Not the model |
| Regulated verticals | Legal, medical and financial need separate compliance review |

## Buyer capacity is a product feature

`routeLead()` refuses to exceed a buyer's declared daily capacity. Overloading a
buyer produces unworked leads, angry enquirers, and disputes. Capacity limits
protect revenue, not just goodwill.
