---
name: facebook-comment-responder
description: Automate Facebook Page comment replies via a webhook server that forwards events into OpenClaw for drafting responses and posts them back through the Graph API.
---

# Facebook Comment Responder

Use this skill when the user wants OpenClaw to reply to Facebook Page comments automatically. It sets up a webhook listener that:

1. Receives Facebook `page` feed/comment events
2. Drafts a response via OpenClaw (using the Gateway `/v1/responses` endpoint)
3. Posts the reply back to the comment through the Graph API

## Prerequisites

- Facebook Page admin access + long-lived Page token with `pages_manage_posts`, `pages_manage_engagement`, `pages_read_engagement`
- Facebook App configured for Webhooks (object `page`) and subscribed to the Page
- OpenClaw Gateway reachable from the webhook server (default `http://127.0.0.1:18789`)
- Gateway HTTP endpoint `/v1/responses` enabled (`gateway.http.endpoints.responses.enabled=true`)

## Files

```
skills/facebook-comment-responder/
├─ .env              # runtime secrets (PAGE_ID, PAGE_TOKEN, VERIFY_TOKEN, etc)
├─ .env.example      # template
├─ SKILL.md          # this file
└─ scripts/
   └─ facebook-webhook.js
```

### `.env` keys

| Key | Description |
| --- | --- |
| `PAGE_ID` | Numeric Facebook Page ID |
| `PAGE_TOKEN` | Long-lived Page access token |
| `VERIFY_TOKEN` | Shared secret used during webhook verification |
| `SERVER_PORT` | Local port for Express server (default 8787) |
| `OPENCLAW_URL` | Gateway base URL (ex: `http://127.0.0.1:18789`) |
| `OPENCLAW_TOKEN` | Gateway auth token |
| `OPENCLAW_AGENT_ID` | Agent ID to run (default `main`) |
| `REPLY_STYLE_PROMPT` | Extra instructions appended before drafting |

## Deploy steps

1. Copy `.env.example` → `.env` and populate values.
2. Install dependencies (already in repo):
   ```bash
   npm install
   ```
3. Run the webhook server:
   ```bash
   cd skills/facebook-comment-responder
   node scripts/facebook-webhook.js
   ```
4. Expose the port to the internet (e.g., `ngrok http 8787`) and note the HTTPS URL.
5. In Meta for Developers → Webhooks:
   - Add callback URL = `<public-url>/facebook/webhook`
   - Verify token = value from `.env`
   - Subscribe object `page` with fields `feed` (includes comments)
   - Add the `Clawniverse` Page to the subscription
6. Test by commenting on a Page post; the server logs should show the event, the OpenClaw draft call, and Graph API reply.

## Behavior / Customization

- Replies skip comments authored by the Page itself.
- Prompt tone controlled via `REPLY_STYLE_PROMPT`.
- Additional filters/logic can be added inside `handleFeedChange`.

## Troubleshooting

- If webhook verification fails: ensure VERIFY_TOKEN matches and the callback URL is reachable over HTTPS.
- Graph API errors usually indicate missing permissions or expired tokens — check the POST response body logged in the server.
- Use `OPENCLAW_AGENT_ID` to swap to different agents/models per Page.
