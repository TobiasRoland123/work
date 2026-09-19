---
status: accepted
---

# Local development replaces Slack with an in-app sandbox

Local development previously required a `trycloudflare.com` tunnel and a dedicated
`WORK Local Dev` Slack app, because Slack needs a public HTTPS URL for both the OAuth
callback and the Events Request URL. A quick tunnel gets a new hostname on every
restart, so the Slack app configuration had to be updated by hand most mornings. We
have removed that path entirely: local development now runs against a Local Sandbox
page that composes messages on behalf of seeded Sandbox Profiles and feeds them into
the same `enqueueSlackEvent` intake the Slack events route uses. Slack integration is
verified on a stable preview deployment instead of on a developer machine.

## Considered options

Keeping the tunnel as a demoted second command was rejected: a path with no stated
trigger for using it decays without anyone noticing, and the tunnel's actual pain was
the rotating hostname, which a fixed preview URL removes. Verifying nothing before
production was rejected because signature verification, OAuth, the queue and directory
sync would then first execute against real users.

## Consequences

Local development no longer needs cloudflared, a Slack app, or a linked Vercel project.
`scripts/local-credentials.mjs` existed solely to write `VERCEL_OIDC_TOKEN` for the
Vercel Queue; since the sandbox calls `processQueuedSlackMessage` in process rather than
publishing, that credential is no longer needed. The only remaining external dependency
is `AI_GATEWAY_API_KEY`.

The sandbox deliberately does not exercise HMAC signature verification, the Vercel Queue
round trip, Slack OAuth, `listSlackUsers` directory sync, or Slack's wire text format
(`&amp;`, `<@U0123>`, `<url|label>`), which nothing in `lib/slack/` unescapes. Changes to
`lib/slack/{events,signature,client,identity}.ts`, `auth.config.ts`, or the queue
configuration must be verified on the preview deployment before merging.

The preview environment needs its own database and its own Slack app credentials.
