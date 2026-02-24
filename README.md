# Facebook Comment Responder

Webhook + skill package that lets a Facebook Page auto-reply to comments using OpenClaw.

## Features
- Express webhook server that receives `feed` events
- Forwards comment text into OpenClaw via `/v1/responses`
- Posts the drafted reply back to Facebook via Graph API
- Configurable tone via `REPLY_STYLE_PROMPT`

## Quick start
1. Copy `.env.example` → `.env` and fill:
   - `PAGE_ID`, `PAGE_TOKEN` (long-lived Page access token)
   - `VERIFY_TOKEN` (any secret string)
   - `OPENCLAW_URL`, `OPENCLAW_TOKEN`, `OPENCLAW_AGENT_ID`
2. Install deps (from repo root):
   ```bash
   npm install
   cd skills/facebook-comment-responder
   node scripts/facebook-webhook.js
   ```
3. Expose the server (ngrok or reverse proxy) and set the callback URL in Meta Webhooks (object `Page`).
4. Subscribe the Page:
   ```bash
   curl -X POST "https://graph.facebook.com/v18.0/<PAGE_ID>/subscribed_apps" \
     -d "subscribed_fields=feed" \
     -d "access_token=<PAGE_TOKEN>"
   ```
5. Comment on the Page to test – OpenClaw will draft and post the reply.

## Packaging
To create a distributable `.skill` file:
```bash
python3 /usr/lib/node_modules/openclaw/skills/skill-creator/scripts/package_skill.py \  
  skills/facebook-comment-responder dist
```

