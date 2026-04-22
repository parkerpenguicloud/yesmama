const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const EDPUZZLE_API = "https://edpuzzle.com/api/v3";

// Helper to make Edpuzzle API calls with the student's token
async function edpuzzleRequest(path, token, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      "Authorization": token,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://edpuzzle.com/"
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${EDPUZZLE_API}${path}`, options);
  return res.json();
}

// ── GET /me — verify token and get user info
app.get("/me", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const data = await edpuzzleRequest("/users/me", token);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user info" });
  }
});

// ── GET /assignments — get all assignments for the student
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

// ── GET /assignment/:assignmentId/:attachmentId/content — get questions for an assignment
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

// ── POST /submit — submit answers for an assignment
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
      answerQuestions: [{
        questionId,
        questionType,
        questionData
      }],
      answerSaveStatus: "answered"
    };

    const data = await edpuzzleRequest(
      `/learning/submissions/${submissionId}/answers`,
      token,
      "POST",
      payload
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to submit answer" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PRIX backend running on port ${PORT}`));
