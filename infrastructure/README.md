# Infrastructure

**Empty, deliberately.** Nothing has been deployed, so there is no
infrastructure-as-code to describe. Writing Terraform for an architecture that
has never run would be describing a system that does not exist.

Local development infrastructure lives in `docker-compose.yml` at the
repository root: PostgreSQL, Redis and Mailpit (a local SMTP sink so that
testing the SMTP adapter cannot reach a real inbox).

`docs/DEPLOYMENT.md` lists what must exist before a first deploy, including the
items that are currently blocking: authentication in the Command Center, a real
job scheduler, and a tested database restore.
