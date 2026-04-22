const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());
app.use(express.json());

async function edpuzzleRequest(path, token, method = "GET", body = null) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  // Set the token cookie so Edpuzzle thinks we're logged in
  await page.setCookie({
    name: "token",
    value: token,
    domain: "edpuzzle.com"
  });

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
    return res.json();
  }, path, token, method, body);

  await browser.close();
  return result;
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
    console.error(err);
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`PRIX backend running on port ${PORT}`));
