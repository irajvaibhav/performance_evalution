const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, '../perf_eval.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL,
    slug TEXT    UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id    INTEGER NOT NULL REFERENCES companies(id),
    name          TEXT    NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK(role IN ('employee', 'hr')),
    manager_id    INTEGER REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS feedback_cycles (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    month      INTEGER NOT NULL,
    year       INTEGER NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
    UNIQUE(company_id, month, year)
  );

  CREATE TABLE IF NOT EXISTS feedback_parameters (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS feedback_submissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_id    INTEGER NOT NULL REFERENCES feedback_cycles(id),
    reviewer_id INTEGER NOT NULL REFERENCES users(id),
    reviewee_id INTEGER NOT NULL REFERENCES users(id),
    submitted_at TEXT,
    UNIQUE(cycle_id, reviewer_id, reviewee_id)
  );

  CREATE TABLE IF NOT EXISTS feedback_scores (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL REFERENCES feedback_submissions(id),
    parameter_id  INTEGER NOT NULL REFERENCES feedback_parameters(id),
    score         INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
    comment       TEXT    NOT NULL,
    UNIQUE(submission_id, parameter_id)
  );
`);

module.exports = db;
