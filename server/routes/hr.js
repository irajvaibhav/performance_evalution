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

// Start a new feedback cycle for this company — auto-creates one pending
// submission per manager -> direct report pair, based on the current
// reporting hierarchy. Any other open cycle for the company is closed first,
// since only one review period should be active at a time.
router.post("/cycles", (req, res) => {
  const { month, year } = req.body;

  if (!Number.isInteger(month) || month < 1 || month > 12)
    return res.status(400).json({ error: "month must be an integer between 1 and 12" });
  if (!Number.isInteger(year))
    return res.status(400).json({ error: "year is required" });

  const existing = db
    .prepare("SELECT id FROM feedback_cycles WHERE company_id = ? AND month = ? AND year = ?")
    .get(req.user.companyId, month, year);
  if (existing) return res.status(400).json({ error: "A cycle already exists for this month" });

  const reports = db
    .prepare("SELECT id, manager_id FROM users WHERE company_id = ? AND manager_id IS NOT NULL")
    .all(req.user.companyId);

  const closeOpenCycles = db.prepare(
    "UPDATE feedback_cycles SET status = 'closed' WHERE company_id = ? AND status = 'open'"
  );
  const insertCycle = db.prepare(
    "INSERT INTO feedback_cycles (company_id, month, year, status) VALUES (?, ?, ?, 'open')"
  );
  const insertSubmission = db.prepare(`
    INSERT INTO feedback_submissions (cycle_id, reviewer_id, reviewee_id, submitted_at)
    VALUES (?, ?, ?, NULL)
  `);

  let cycleId;
  db.exec("BEGIN");
  try {
    closeOpenCycles.run(req.user.companyId);
    cycleId = insertCycle.run(req.user.companyId, month, year).lastInsertRowid;
    reports.forEach((u) => insertSubmission.run(cycleId, u.manager_id, u.id));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  res.json({ success: true, cycleId, submissionsCreated: reports.length });
});

// Manually close a cycle (stops any further submissions against it)
router.post("/cycles/:id/close", (req, res) => {
  const cycle = db
    .prepare("SELECT * FROM feedback_cycles WHERE id = ? AND company_id = ?")
    .get(req.params.id, req.user.companyId);

  if (!cycle) return res.status(404).json({ error: "Cycle not found" });
  if (cycle.status === "closed") return res.status(400).json({ error: "Cycle already closed" });

  db.prepare("UPDATE feedback_cycles SET status = 'closed' WHERE id = ?").run(cycle.id);
  res.json({ success: true });
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
