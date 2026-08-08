const bcrypt = require("bcrypt");
const db = require("./db");

const SALT_ROUNDS = 10;

function hash(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

function clearAll() {
  db.exec(`
    DELETE FROM feedback_scores;
    DELETE FROM feedback_submissions;
    DELETE FROM feedback_parameters;
    DELETE FROM feedback_cycles;
    DELETE FROM users;
    DELETE FROM companies;
    DELETE FROM sqlite_sequence
      WHERE name IN ('feedback_scores', 'feedback_submissions', 'feedback_parameters', 'feedback_cycles', 'users', 'companies');
  `);
}

function seedParameters() {
  const params = [
    { name: "Ownership", description: "Takes responsibility for their work and outcomes" },
    { name: "Communication", description: "Clarity and effectiveness in written and verbal communication" },
    { name: "Quality of Work", description: "Accuracy, thoroughness, and standards of output" },
    { name: "Initiative", description: "Proactively identifies problems and drives solutions" },
    { name: "Collaboration", description: "Works effectively with teammates and cross-functional stakeholders" },
  ];

  const insert = db.prepare(
    "INSERT INTO feedback_parameters (name, description) VALUES (@name, @description)"
  );
  params.forEach((p) => insert.run(p));
}

function seedAshoka() {
  const { lastInsertRowid: companyId } = db
    .prepare("INSERT INTO companies (name, slug) VALUES (?, ?)")
    .run("Ashoka Textiles", "ashoka");

  const insertUser = db.prepare(`
    INSERT INTO users (company_id, name, email, password_hash, role, manager_id)
    VALUES (@company_id, @name, @email, @password_hash, @role, @manager_id)
  `);

  const pw = hash("pass123");

  // Kavita — HR, no manager
  const { lastInsertRowid: kavitaId } = insertUser.run({
    company_id: companyId, name: "Kavita Sharma", email: "kavita@ashoka.com",
    password_hash: pw, role: "hr", manager_id: null,
  });

  // COO — top of hierarchy
  const { lastInsertRowid: cooId } = insertUser.run({
    company_id: companyId, name: "Suresh COO", email: "suresh@ashoka.com",
    password_hash: pw, role: "employee", manager_id: null,
  });

  // Rohan reports to COO
  const { lastInsertRowid: rohanId } = insertUser.run({
    company_id: companyId, name: "Rohan Mehta", email: "rohan@ashoka.com",
    password_hash: pw, role: "employee", manager_id: cooId,
  });

  // Priya reports to Rohan
  const { lastInsertRowid: priyaId } = insertUser.run({
    company_id: companyId, name: "Priya Nair", email: "priya@ashoka.com",
    password_hash: pw, role: "employee", manager_id: rohanId,
  });

  // Priya's 6 team members
  const priyaReports = [
    { name: "Amit Verma",   email: "amit@ashoka.com" },
    { name: "Sunita Das",   email: "sunita@ashoka.com" },
    { name: "Deepak Rao",   email: "deepak@ashoka.com" },
    { name: "Meena Joshi",  email: "meena@ashoka.com" },
    { name: "Vijay Kumar",  email: "vijay@ashoka.com" },
    { name: "Pooja Singh",  email: "pooja@ashoka.com" },
  ];

  const reportIds = priyaReports.map(({ name, email }) => {
    const { lastInsertRowid } = insertUser.run({
      company_id: companyId, name, email,
      password_hash: pw, role: "employee", manager_id: priyaId,
    });
    return lastInsertRowid;
  });

  const parameters = db.prepare("SELECT id FROM feedback_parameters").all();

  // July 2026 — closed cycle with scores already submitted
  const { lastInsertRowid: julyCycleId } = db
    .prepare("INSERT INTO feedback_cycles (company_id, month, year, status) VALUES (?, ?, ?, ?)")
    .run(companyId, 7, 2026, "closed");

  const insertSubmission = db.prepare(`
    INSERT INTO feedback_submissions (cycle_id, reviewer_id, reviewee_id, submitted_at)
    VALUES (@cycle_id, @reviewer_id, @reviewee_id, @submitted_at)
  `);

  const insertScore = db.prepare(`
    INSERT INTO feedback_scores (submission_id, parameter_id, score, comment)
    VALUES (@submission_id, @parameter_id, @score, @comment)
  `);

  function createFilledSubmission(cycleId, reviewerId, revieweeId, scores) {
    const { lastInsertRowid: subId } = insertSubmission.run({
      cycle_id: cycleId, reviewer_id: reviewerId,
      reviewee_id: revieweeId, submitted_at: new Date().toISOString(),
    });
    parameters.forEach((param, i) => {
      insertScore.run({
        submission_id: subId, parameter_id: param.id,
        score: scores[i], comment: `Good performance on this parameter in July.`,
      });
    });
  }

  // Priya reviews all 6 in July
  reportIds.forEach((rid) => createFilledSubmission(julyCycleId, priyaId, rid, [4, 3, 5, 4, 4]));
  // Rohan reviews Priya in July
  createFilledSubmission(julyCycleId, rohanId, priyaId, [5, 4, 5, 3, 4]);
  // COO reviews Rohan in July
  createFilledSubmission(julyCycleId, cooId, rohanId, [4, 4, 4, 4, 5]);

  // August 2026 — open cycle, all submissions pending
  const { lastInsertRowid: augCycleId } = db
    .prepare("INSERT INTO feedback_cycles (company_id, month, year, status) VALUES (?, ?, ?, ?)")
    .run(companyId, 8, 2026, "open");

  function createPendingSubmission(cycleId, reviewerId, revieweeId) {
    insertSubmission.run({
      cycle_id: cycleId, reviewer_id: reviewerId,
      reviewee_id: revieweeId, submitted_at: null,
    });
  }

  reportIds.forEach((rid) => createPendingSubmission(augCycleId, priyaId, rid));
  createPendingSubmission(augCycleId, rohanId, priyaId);
  createPendingSubmission(augCycleId, cooId, rohanId);

  return companyId;
}

function seedBrightPath() {
  const { lastInsertRowid: companyId } = db
    .prepare("INSERT INTO companies (name, slug) VALUES (?, ?)")
    .run("Bright Path Consulting", "brightpath");

  const insertUser = db.prepare(`
    INSERT INTO users (company_id, name, email, password_hash, role, manager_id)
    VALUES (@company_id, @name, @email, @password_hash, @role, @manager_id)
  `);

  const pw = hash("pass123");

  const { lastInsertRowid: founderId } = insertUser.run({
    company_id: companyId, name: "Arjun Founder", email: "arjun@brightpath.com",
    password_hash: pw, role: "employee", manager_id: null,
  });

  insertUser.run({
    company_id: companyId, name: "Nisha HR", email: "nisha@brightpath.com",
    password_hash: pw, role: "hr", manager_id: null,
  });

  const directReports = [
    { name: "Rahul Bose",    email: "rahul@brightpath.com" },
    { name: "Ananya Iyer",   email: "ananya@brightpath.com" },
    { name: "Kiran Malhotra",email: "kiran@brightpath.com" },
    { name: "Tanya Gupta",   email: "tanya@brightpath.com" },
    { name: "Sanjay Reddy",  email: "sanjay@brightpath.com" },
    { name: "Leena Pillai",  email: "leena@brightpath.com" },
    { name: "Nikhil Jain",   email: "nikhil@brightpath.com" },
    { name: "Divya Kapoor",  email: "divya@brightpath.com" },
  ];

  const reportIds = directReports.map(({ name, email }) => {
    const { lastInsertRowid } = insertUser.run({
      company_id: companyId, name, email,
      password_hash: pw, role: "employee", manager_id: founderId,
    });
    return lastInsertRowid;
  });

  // August 2026 — open cycle, partially submitted
  const { lastInsertRowid: augCycleId } = db
    .prepare("INSERT INTO feedback_cycles (company_id, month, year, status) VALUES (?, ?, ?, ?)")
    .run(companyId, 8, 2026, "open");

  const parameters = db.prepare("SELECT id FROM feedback_parameters").all();

  const insertSubmission = db.prepare(`
    INSERT INTO feedback_submissions (cycle_id, reviewer_id, reviewee_id, submitted_at)
    VALUES (@cycle_id, @reviewer_id, @reviewee_id, @submitted_at)
  `);

  const insertScore = db.prepare(`
    INSERT INTO feedback_scores (submission_id, parameter_id, score, comment)
    VALUES (@submission_id, @parameter_id, @score, @comment)
  `);

  // First 3 submitted, rest pending
  reportIds.forEach((rid, index) => {
    const submitted = index < 3;
    const { lastInsertRowid: subId } = insertSubmission.run({
      cycle_id: augCycleId, reviewer_id: founderId, reviewee_id: rid,
      submitted_at: submitted ? new Date().toISOString() : null,
    });

    if (submitted) {
      parameters.forEach((param) => {
        insertScore.run({
          submission_id: subId, parameter_id: param.id,
          score: Math.floor(Math.random() * 3) + 3,
          comment: "Performed well this month.",
        });
      });
    }
  });
}

clearAll();
seedParameters();
seedAshoka();
seedBrightPath();

console.log("Seed complete.");
console.log("Ashoka Textiles logins: priya@ashoka.com, rohan@ashoka.com, kavita@ashoka.com | pass: pass123");
console.log("Bright Path logins: arjun@brightpath.com, nisha@brightpath.com | pass: pass123");
