#!/usr/bin/env node
import express from "express";
import crypto from "crypto";
import "dotenv/config";

const {
  PAGE_ID,
  PAGE_TOKEN,
  VERIFY_TOKEN,
  SERVER_PORT = 8787,
  OPENCLAW_URL = "http://127.0.0.1:18789",
  OPENCLAW_TOKEN,
  OPENCLAW_AGENT_ID = "main",
  REPLY_STYLE_PROMPT = "ตอบในฐานะแอดมินเพจ Clawniverse ที่ให้ความรู้ OpenClaw แบบเข้าถึงง่าย"
} = process.env;

if (!PAGE_ID || !PAGE_TOKEN || !VERIFY_TOKEN || !OPENCLAW_TOKEN) {
  console.error("Missing required environment variables. Check .env file.");
  process.exit(1);
}

const app = express();
app.use(express.json({ verify: addRawBody }));

function addRawBody(req, res, buf) {
  req.rawBody = buf?.toString("utf8") ?? "";
}

app.get("/facebook/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified", req.query);
    return res.status(200).send(challenge ?? "OK");
  }

  console.warn("Webhook verify failed", req.query);
  res.sendStatus(403);
});

app.post("/facebook/webhook", async (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  if (body?.object !== "page" || !Array.isArray(body.entry)) return;

  for (const entry of body.entry) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== "feed") continue;
      handleFeedChange(change.value).catch((err) => {
        console.error("Feed change handling failed", err);
      });
    }
  }
});

async function handleFeedChange(value) {
  if (!value?.comment_id || !value?.message) return;
  if (value.from?.id === PAGE_ID) {
    console.log("Skip own page comment", value.comment_id);
    return;
  }

  console.log(`Incoming comment ${value.comment_id}: ${value.message}`);

  const replyText = await draftReply({
    commenterName: value.from?.name,
    commentText: value.message,
    postId: value.post_id,
    commentId: value.comment_id
  });

  if (!replyText) {
    console.log("No reply generated");
    return;
  }

  await replyToComment(value.comment_id, replyText);
}

async function draftReply({ commenterName, commentText, postId, commentId }) {
  const systemPrompt = [
    REPLY_STYLE_PROMPT,
    "- อย่ากล่าวอ้างเกินจริง/ระบุสิ่งที่ไม่รู้",
    "- หากข้อมูลไม่พอให้เชิญชวนผู้ใช้ทักเพจแทน"
  ].join("\n");

  try {
    const response = await fetch(`${OPENCLAW_URL.replace(/\/$/, "")}/v1/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENCLAW_TOKEN}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": OPENCLAW_AGENT_ID
      },
      body: JSON.stringify({
        model: "openclaw",
        instructions: systemPrompt,
        input: [
          {
            type: "message",
            role: "user",
            content: `คอมเมนต์ใหม่จาก ${commenterName ?? "ผู้ใช้"}: ${commentText}`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenClaw API error ${response.status}`);
    }

    const data = await response.json();
    return extractOutputText(data);
  } catch (err) {
    console.error("draftReply error", err);
    return null;
  }
}

function extractOutputText(data) {
  const items = data?.output ?? [];
  const chunks = [];
  for (const item of items) {
    if (item.type === "message") {
      const textParts = item.content?.filter((c) => c.type === "output_text") ?? [];
      for (const part of textParts) {
        if (part.text) chunks.push(part.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

async function replyToComment(commentId, message) {
  const url = new URL(`https://graph.facebook.com/v18.0/${commentId}/comments`);
  url.searchParams.set("access_token", PAGE_TOKEN);
  url.searchParams.set("message", message);

  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Graph API error ${response.status}: ${body}`);
  }
  const json = await response.json();
  console.log("Replied to", commentId, json?.id || "(no id)");
}

app.listen(Number(SERVER_PORT), () => {
  console.log(`Facebook webhook listening on port ${SERVER_PORT}`);
});
