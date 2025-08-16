// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import nodemailer from "nodemailer"; // Import nodemailer
import bodyParser from "body-parser";

dotenv.config();
const apiKey = process.env.GROQ_API_KEY;

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure Nodemailer transporter
// You will need to use your own email credentials and app password.
const transporter = nodemailer.createTransport({
  service: "gmail", // You can use other services like 'Outlook365' or 'SendGrid'
  auth: {
    user: process.env.EMAIL_USER, // Your email address from .env
    pass: process.env.EMAIL_PASS, // Your App Password from .env
  },
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Summarize route
app.post("/api/summarize-form", async (req, res) => {
  try {
    const { text, instruction } = req.body;

    if (!text) {
      return res
        .status(400)
        .json({ error: "Text is required for summarization" });
    }

    const userPrompt = `Summarize the following transcript in a detailed, point-wise manner. Start each point with a bullet (•).\n\nUser Instruction: ${instruction}\n\nTranscript:\n${text}`;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates summaries.",
          },
          { role: "user", content: userPrompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const summary = response.data.choices[0].message.content;
    res.json({ summary });
  } catch (error) {
    console.error("Error summarizing:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to summarize" });
  }
});

// Share via email (now sends a real email)
app.post("/api/share-form", async (req, res) => {
  const { to, subject, text } = req.body;

  if (!to || !subject || !text) {
    return res.status(400).json({ error: "Missing email fields" });
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: to,
    subject: subject,
    html: `<p>${text.replace(/\n/g, "<br>")}</p>`, // Convert newlines to HTML line breaks
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
