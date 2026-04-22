const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { HttpsProxyAgent } = require("https-proxy-agent");

const app = express();
app.use(cors());
app.use(express.json());

const EDPUZZLE_API = "https://edpuzzle.com/api/v3";

// Residential proxy config
const PROXY = "http://dfluaumh:on8j25ysxoxi@31.59.20.176:6754";
const agent = new HttpsProxyAgent(PROXY);

async function edpuzzleRequest(path, token, method = "GET", body = null) {
  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
  const options = {
    method,
    agent,
    headers: {
      "Authorization": cleanToken,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://edpuzzle.com/",
      "Origin": "https://edpuzzle.com"
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${EDPUZZLE_API}${path}`, options);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: text }; }
}

// GET /me
app.get("/me", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const data = await edpuzzleRequest("/users/me", token);
    console.log("/me response:", JSON.stringify(data).slice(0, 200));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user info" });
  }
});

// GET /assignments
app.get("/assignments", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const data = await edpuzzleRequest("/learning/submissions", token);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

// GET /assignment/:assignmentId/:attachmentId/content
app.get("/assignment/:assignmentId/:attachmentId/content", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const { assignmentId, attachmentId } = req.params;
    const data = await edpuzzleRequest(
      `/learning/assignments/${assignmentId}/attachments/${attachmentId}/content`,
      token
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch assignment content" });
  }
});

// POST /submit
app.post("/submit", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });
  const { submissionId, questionId, questionType, choiceIds, openAnswer } = req.body;
  if (!submissionId || !questionId) {
    return res.status(400).json({ error: "Missing submissionId or questionId" });
  }
  try {
    const questionData = questionType === "open-ended"
      ? { body: openAnswer }
      : { choiceIds };
    const payload = {
      answerQuestions: [{ questionId, questionType, questionData }],
      answerSaveStatus: "answered"
    };
    const data = await edpuzzleRequest(
      `/learning/submissions/${submissionId}/answers`,
      token, "POST", payload
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to submit answer" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PRIX backend running on port ${PORT}`));
