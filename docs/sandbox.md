# Sandbox access

The `/sandbox` console can run locally against fixture data or on a hosted deployment for
explicitly granted operators. Hosted access uses the operator's real Slack session. The
account must be mapped to the deployment's configured `SLACK_TEAM_ID`, active, and have
`users.can_use_sandbox=true`. This permission is independent of Message quality review
(`can_review_messages`) and admin access.

## Production setup and access

Deploy database migration `0041_sandbox_access.sql` before using the hosted console. It adds
the permission and grants it to Tobias Roland's Slack identity (`T02HKL21R` /
`U05NP1NF3QB`). If his account is first provisioned after migration, identity provisioning
also grants the initial account. Other accounts receive no automatic grant, including
admins.

Grant or revoke access using the exact internal user ID:

```bash
pnpm sandbox:access grant <exact-user-id>
pnpm sandbox:access revoke <exact-user-id>
```

Run the command with `NODE_ENV=production`, the intended production `DATABASE_URL`, and
the matching `SLACK_TEAM_ID` in a private operator environment. Granting verifies that
the selected account belongs to that configured team and is active. Keep these real Slack
team and channel settings unchanged; do not set either to `T_LOCAL` or `C_LOCAL` on a
hosted deployment.

## Local profile sign-in and hosted console

Signing in as a Sandbox Profile is local-only. It is enabled only when
`NODE_ENV !== 'production'` and `SLACK_TEAM_ID=T_LOCAL`; the credentials provider is not
registered in production. The hosted console uses the current real Slack identity and the
account grant above. Fixture profiles can still be seeded from its page.

## Isolation and processing

Sandbox-created inbox events, message reads, retries, and reset operations use the fixed
`T_LOCAL` team and sandbox channel. Expiry cleanup, retries, and reset affect sandbox data only.
Sandbox processing suppresses broadcasts. Normal application list readers remain scoped
to the configured real Slack team, so sandbox fixture records do not appear in Week or
Contact views. Never change the deployment's real Slack configuration to make sandbox
events pass through the normal Slack intake.

Deterministic shorthand messages work without an AI Gateway key. Other messages need
`AI_GATEWAY_API_KEY` configured for the deployment to receive model interpretation.

For local setup and the console workflow, see [Local development](local-development.md).
