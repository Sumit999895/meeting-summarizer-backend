// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import nodemailer from "nodemailer";
import bodyParser from "body-parser";
import fetch from "node-fetch"; // Import fetch for streaming

dotenv.config();
const apiKey = process.env.GROQ_API_KEY;

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Summarize route (UPDATED FOR STREAMING)
app.post("/api/summarize-form", async (req, res) => {
  try {
    const { text, instruction } = req.body;

    if (!text) {
      return res
        .status(400)
        .json({ error: "Text is required for summarization" });
    }

    const userPrompt = `Summarize the following transcript in a detailed, point-wise manner. Start each point with a bullet (•).\n\nUser Instruction: ${instruction}\n\nTranscript:\n${text}`;

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that generates summaries.",
            },
            { role: "user", content: userPrompt },
          ],
          stream: true, // Tell Groq to stream the response
        }),
      }
    );

    // Set headers for a Server-Sent Event (SSE) stream
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Stream the response from Groq directly to the client
    groqResponse.body.on("data", (chunk) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        if (line.startsWith("data:")) {
          const json = line.substring(5).trim();
          if (json === "[DONE]") {
            res.end();
            return;
          }
          try {
            const data = JSON.parse(json);
            const content = data.choices[0].delta.content;
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            console.error("Error parsing JSON:", e);
          }
        }
      }
    });

    groqResponse.body.on("error", (err) => {
      console.error("Groq stream error:", err);
      res.end();
    });
  } catch (error) {
    console.error("Error summarizing:", error.message);
    res.status(500).json({ error: "Failed to summarize" });
  }
});

app.post("/api/share-form", async (req, res) => {
  const { to, subject, text } = req.body;

  if (!to || !subject || !text) {
    return res.status(400).json({ error: "Missing email fields" });
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: to,
    subject: subject,
    html: `<p>${text.replace(/\n/g, "<br>")}</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📧 Email sent successfully!");
    res.json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
