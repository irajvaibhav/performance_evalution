const express = require("express");
const db = require("../db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

router.use(verifyToken);

// Submissions I need to fill out (I am the reviewer, not yet submitted)
router.get("/pending", (req, res) => {
  const rows = db.prepare(`
    SELECT
      fs.id         AS submission_id,
      u.name        AS reviewee_name,
      u.email       AS reviewee_email,
      fc.month,
      fc.year
    FROM feedback_submissions fs
    JOIN users u          ON u.id  = fs.reviewee_id
    JOIN feedback_cycles fc ON fc.id = fs.cycle_id
    WHERE fs.reviewer_id  = ?
      AND fs.submitted_at IS NULL
      AND fc.status       = 'open'
      AND fc.company_id   = ?
    ORDER BY fc.year DESC, fc.month DESC
  `).all(req.user.id, req.user.companyId);

  res.json(rows);
});

// My received feedback history grouped by cycle then parameter
router.get("/received", (req, res) => {
  const rows = db.prepare(`
    SELECT
      fc.month,
      fc.year,
      fp.name       AS parameter,
      fsc.score,
      fsc.comment,
      u.name        AS reviewer_name
    FROM feedback_scores fsc
    JOIN feedback_submissions fs ON fs.id = fsc.submission_id
    JOIN feedback_cycles fc      ON fc.id = fs.cycle_id
    JOIN feedback_parameters fp  ON fp.id = fsc.parameter_id
    JOIN users u                 ON u.id  = fs.reviewer_id
    WHERE fs.reviewee_id = ?
      AND fc.company_id  = ?
    ORDER BY fc.year DESC, fc.month DESC, fp.id ASC
  `).all(req.user.id, req.user.companyId);

  res.json(rows);
});

// Parameters list (needed when rendering the feedback form)
router.get("/parameters", (req, res) => {
  const params = db.prepare("SELECT * FROM feedback_parameters").all();
  res.json(params);
});

// Submit feedback for a submission
router.post("/submit/:submissionId", (req, res) => {
  const { submissionId } = req.params;
  const { scores } = req.body;
  const parameterIds = db
    .prepare("SELECT id FROM feedback_parameters ORDER BY id")
    .all()
    .map((param) => param.id);

  const submission = db
    .prepare(`
      SELECT fs.*, fc.status AS cycle_status
      FROM feedback_submissions fs
      JOIN feedback_cycles fc ON fc.id = fs.cycle_id
      WHERE fs.id = ?
    `)
    .get(submissionId);

  if (!submission) return res.status(404).json({ error: "Submission not found" });
  if (submission.reviewer_id !== req.user.id) return res.status(403).json({ error: "Not your submission" });
  if (submission.submitted_at) return res.status(400).json({ error: "Already submitted" });
  if (submission.cycle_status !== "open") return res.status(400).json({ error: "This feedback cycle is closed" });

  if (!Array.isArray(scores) || scores.length !== parameterIds.length)
    return res.status(400).json({ error: "Provide scores for all 5 parameters" });

  const seenParameterIds = new Set();
  for (const s of scores) {
    const parameterId = Number(s.parameterId);
    const score = Number(s.score);

    if (!Number.isInteger(parameterId) || !parameterIds.includes(parameterId) || seenParameterIds.has(parameterId))
      return res.status(400).json({ error: "Each score must use a unique valid parameter" });
    seenParameterIds.add(parameterId);

    if (!Number.isInteger(score) || !s.comment)
      return res.status(400).json({ error: "Each score needs parameterId, score, and comment" });
    if (score < 1 || score > 5)
      return res.status(400).json({ error: "Score must be between 1 and 5" });
  }

  const insertScore = db.prepare(`
    INSERT INTO feedback_scores (submission_id, parameter_id, score, comment)
    VALUES (?, ?, ?, ?)
  `);

  const markSubmitted = db.prepare(`
    UPDATE feedback_submissions SET submitted_at = ? WHERE id = ?
  `);

  db.exec('BEGIN');
  try {
    scores.forEach(({ parameterId, score, comment }) => {
      insertScore.run(submissionId, parameterId, score, comment.trim());
    });
    markSubmitted.run(new Date().toISOString(), submissionId);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  res.json({ success: true });
});

module.exports = router;
