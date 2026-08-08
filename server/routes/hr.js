const express = require("express");
const db = require("../db");
const { verifyToken, requireHR } = require("../middleware/auth");

const router = express.Router();

router.use(verifyToken, requireHR);

// All cycles for this HR's company
router.get("/cycles", (req, res) => {
  const cycles = db
    .prepare("SELECT * FROM feedback_cycles WHERE company_id = ? ORDER BY year DESC, month DESC")
    .all(req.user.companyId);

  res.json(cycles);
});

// For a given cycle — all submissions with status, reviewer name, reviewee name
router.get("/submissions", (req, res) => {
  const { cycleId } = req.query;
  if (!cycleId) return res.status(400).json({ error: "cycleId required" });

  const cycle = db
    .prepare("SELECT * FROM feedback_cycles WHERE id = ? AND company_id = ?")
    .get(cycleId, req.user.companyId);

  if (!cycle) return res.status(404).json({ error: "Cycle not found" });

  const rows = db.prepare(`
    SELECT
      fs.id           AS submission_id,
      reviewer.name   AS reviewer_name,
      reviewer.email  AS reviewer_email,
      reviewee.name   AS reviewee_name,
      reviewee.email  AS reviewee_email,
      fs.submitted_at
    FROM feedback_submissions fs
    JOIN users reviewer ON reviewer.id = fs.reviewer_id
    JOIN users reviewee ON reviewee.id = fs.reviewee_id
    WHERE fs.cycle_id = ?
    ORDER BY reviewer.name, reviewee.name
  `).all(cycleId);

  const total   = rows.length;
  const done    = rows.filter((r) => r.submitted_at).length;
  const pending = total - done;

  res.json({ cycle, total, done, pending, submissions: rows });
});

module.exports = router;
