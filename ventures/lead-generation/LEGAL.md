# Legal

**Not legal advice. Nothing here has been reviewed by an attorney.**

## Constraints in the manifest

1. Call recording requires jurisdiction-specific consent handling; do not enable
   recording until the applicable state rules are documented per territory.
2. Lead forms must carry a clear disclosure that the enquiry will be shared with
   a service provider.
3. Do not represent the venture as the service provider itself.
4. Regulated verticals (legal, financial, medical) require a separate compliance
   review before any campaign runs.
5. Every buyer agreement must state that no lead volume is guaranteed.

## Call recording — the sharpest issue

Consent requirements differ by state, and some require **all parties** to
consent. A single national recording policy is wrong somewhere.

Before recording anything:

- [ ] Document the rule for each state in the service territory
- [ ] Implement per-territory consent handling, not a global setting
- [ ] Use the standard recording disclosure at call start
- [ ] Confirm retention limits per jurisdiction

The platform holds a `REQUIRED_DISCLOSURES.callRecording` string but **does not
encode state-level differences**. Until it does, recording stays off. This is
listed in `docs/KNOWN_LIMITATIONS.md`.

## Form disclosure

The enquirer must know their information goes to a contractor. Not buried in a
privacy policy — on the form, near the submit button, in plain words.

This also protects the business: an enquirer who understood the arrangement does
not file a complaint when a contractor calls.

## Not being the service provider

The brand must not imply we perform roofing work. Misrepresentation invites
liability for the contractor's work, which is not a risk this venture is
compensated for.

## Consent and suppression

Enquirers submitted a form, which is consent for a contractor to contact them
about *that enquiry*. It is not consent for marketing, and it is not consent for
another venture in the portfolio.

The compliance layer enforces the ordering — suppression beats consent, and
organization-scoped suppressions apply portfolio-wide.

## Data shared with buyers

Enquirer contact details go to the buyer. That means:

- [ ] The buyer agreement must restrict use to responding to this enquiry
- [ ] The buyer must not add them to a marketing list
- [ ] Our privacy policy must disclose the sharing

## Regulated verticals

Legal, financial and medical lead generation carry licensing and advertising
rules that vary by state and that this platform does not model. Not entered
without a separate compliance review.

## Before the first lead is sold

- [ ] Buyer agreement reviewed, including the no-volume-guarantee clause
- [ ] Form disclosure language reviewed
- [ ] Privacy policy covering the sharing
- [ ] Per-state call recording rules documented if calls are tracked
- [ ] Refund and credit policy written down before the first dispute
