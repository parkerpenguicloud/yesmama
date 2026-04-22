const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

// ─── Puppeteer request helper ─────────────────────────────────────────────────
async function edpuzzleRequest(path, token, method = "GET", body = null) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"]
  });
  const page = await browser.newPage();

  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

  await page.setCookie({
    name: "token",
    value: token,
    domain: ".edpuzzle.com",
    path: "/",
    httpOnly: false,
    secure: true
  });

  await page.goto("https://edpuzzle.com", { waitUntil: "networkidle2", timeout: 30000 });

  const result = await page.evaluate(async (path, token, method, body) => {
    const options = {
      method,
      headers: {
        "Authorization": token,
        "Content-Type": "application/json"
      }
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`https://edpuzzle.com/api/v3${path}`, options);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { error: "non-json response", status: res.status, body: text.slice(0, 500) };
    }
  }, path, token, method, body);

  await browser.close();
  return result;
}

// ─── GET /me ──────────────────────────────────────────────────────────────────
// Returns user profile including _id (userId)
app.get("/me", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const data = await edpuzzleRequest("/users/me", token);
    console.log("/me response:", JSON.stringify(data).slice(0, 200));
    if (!data || data.error || !data._id) return res.status(401).json({ error: "Invalid token", detail: data });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /classrooms ──────────────────────────────────────────────────────────
// Returns all active classrooms for the student
app.get("/classrooms", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const data = await edpuzzleRequest("/classrooms/active", token);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /assignments/:classroomId ───────────────────────────────────────────
// Returns all in-progress/not-started assignments for a classroom
// Requires userId query param (from /me response)
app.get("/assignments/:classroomId", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });
  const { classroomId } = req.params;
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId query param" });
  try {
    const path = `/learning/assignment_learners/users/${userId}/classrooms/${classroomId}?status[]=not-started&status[]=in-progress&isUpcoming=false&cursor=0`;
    const data = await edpuzzleRequest(path, token);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /assignment/:assignmentId ───────────────────────────────────────────
// Returns full assignment detail including attachments and submission IDs
// Requires userId query param
app.get("/assignment/:assignmentId", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });
  const { assignmentId } = req.params;
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId query param" });
  try {
    const data = await edpuzzleRequest(`/learning/assignments/${assignmentId}/users/${userId}`, token);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /content/:assignmentId/:attachmentId ────────────────────────────────
// Returns questions for a specific attachment
app.get("/content/:assignmentId/:attachmentId", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });
  const { assignmentId, attachmentId } = req.params;
  try {
    const data = await edpuzzleRequest(
      `/learning/assignments/${assignmentId}/attachments/${attachmentId}/content`,
      token
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /submit ─────────────────────────────────────────────────────────────
// Submit answers for a submission
// Body: { submissionId, questionId, questionType, choiceIds, openAnswer }
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
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`PRIX backend running on port ${PORT}`));
