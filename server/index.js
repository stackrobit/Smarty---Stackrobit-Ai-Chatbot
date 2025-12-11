require("dotenv").config();
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));
const { v4: uuidv4 } = require("uuid");

// your intent keywords
const intents = require("./intents.json");

// your company data file
const company = require("./company-data.json");

const app = express();
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());

// Rate limiting
app.use(
  "/api/",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
  })
);

// Serve frontend
app.use(express.static(path.join(__dirname, "..", "public")));

// Memory store for sessions
let convStore = new Map();
const MAX_HISTORY = 10;

// Intent checker
function matchIntent(msg) {
  const m = msg.toLowerCase();
  for (let intent of intents) {
    for (let k of intent.keywords) {
      if (m.includes(k.toLowerCase())) return intent;
    }
  }
  return null;
}

// CHAT API
app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message)
      return res.status(400).json({ error: "Message is required" })
    
    let sid = sessionId || uuidv4();

    if(message.toLowerCase().includes("send as email") || 
   message.toLowerCase().includes("send as mail") ||
   message.toLowerCase().includes("project")) {
  
  await sendSupportEmail(message);
  console.log("SUPPORT_EMAIL:", process.env.SUPPORT_EMAIL);
  console.log("PASSWORD EXISTS:", !!process.env.SUPPORT_EMAIL_PASSWORD);

  return res.json({
    reply: "I have sent your message to our support team. They will contact you soon!",
    sessionId: sid
  });
};
    


    // Intent check
    const intent = matchIntent(message);
    if (intent) {
      return res.json({
        reply: intent.reply,
        sessionId: sessionId || uuidv4(),
      });
    }

    // Session memory

    let history = convStore.get(sid) || [];
    history.push({ role: "user", content: message });

    if (history.length > MAX_HISTORY) {
      history = history.slice(history.length - MAX_HISTORY);
    }

    
    // Validate API key
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY)
      return res.status(500).json({ error: "OPENAI_API_KEY missing" });

    // COMPANY-AWARE SYSTEM PROMPT
    const systemPrompt = `
You are the official customer support AI of ${company.company_name}.
Answer ONLY using the company's real information:

Company Name: ${company.company_name}
Tagline: ${company.tagline}
Services: ${company.services.join(", ")}
Email: ${company.email}
Phone: ${company.phone}
WhatsApp: ${company.whatsapp}
Location: ${company.location}

About Us: ${company.about}
Pricing Info: ${company.pricing_info}

Rules:
- ALWAYS speak as ${company.company_name} support team.
- NEVER invent details not provided.
- If user asks for services → use services list.
- If user asks for pricing → use Pricing Info.
- If user asks for contact → give Email, WhatsApp, Phone.
- If user wants project → guide them politely.
- If user says "send mail", "mail this", "contact me" → say:
  "I can forward this message to our support team."
- Keep messages short, friendly & professional.
`;

    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
      ],
      temperature: 0.2,
      max_tokens: 400,
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const j = await r.json();
    const reply = j.choices?.[0]?.message?.content || "Sorry, try again!";

    history.push({ role: "assistant", content: reply });
    convStore.set(sid, history);

    return res.json({ reply, sessionId: sid });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// fallback route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(3000, () => console.log("🚀 Server running on port 3000"));


