import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/summarize-form", async (req, res) => {
  try {
    const { transcript, instruction } = req.body;

    // 🛑 If no Groq API yet, return dummy response
    if (!process.env.GROQ_API_KEY) {
      return res.json({
        summary: [
          "Dummy Summary Point 1",
          "Dummy Summary Point 2",
          "Dummy Summary Point 3"
        ].join("\n")
      });
    }

    // ✅ Example request to Groq API
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: "You are an assistant that summarizes transcripts into **pointwise format**."
          },
          {
            role: "user",
            content: `Transcript: ${transcript}\nInstruction: ${instruction}`
          }
        ]
      })
    });

    const data = await response.json();
    const summary = data?.choices?.[0]?.message?.content || "No summary generated";

    res.json({ summary });

  } catch (error) {
    console.error("Error in summarization:", error);
    res.status(500).json({ error: "Failed to summarize" });
  }
});

export default router;
