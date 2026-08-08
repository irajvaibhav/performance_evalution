# Performance Evaluation Tool

A multi-tenant performance evaluation tool designed for managers to provide monthly feedback to team members across 5 core parameters, with role-based dashboard views for Employees and HR.

## 🚀 Features

- **Multi-Tenant Architecture**: Supports multiple client companies within a single application (e.g. Ashoka Textiles & Bright Path Consulting).
- **Flexible Reporting Hierarchy**: Supports multi-tier management structure (COO → Rohan → Priya → Reports) as well as flat structures (Founder → 8 Direct Reports).
- **5 Core Evaluation Parameters**: Fixed parameters covering Ownership, Communication, Quality of Work, Initiative, and Collaboration.
- **Role-Based Access Control (RBAC)**:
  - **Employee**: View received monthly feedback & parameter performance history over time.
  - **Manager**: Fill out feedback forms with 1-5 ratings & mandatory comments for direct reports.
  - **HR**: Submission tracking dashboard to monitor completion status (submitted vs. pending) per monthly cycle.
- **Stateless JWT Authentication**: Secure server-side validation ensuring users only access their own company data and relevant role actions.

---

## 🛠️ Data Model & Key Design Decisions

```
Company (id, name, slug)
  │
  ├── User (id, company_id, name, email, password_hash, role, manager_id)
  │     └── manager_id references User(id) [Self-referencing hierarchy]
  │
  └── FeedbackCycle (id, company_id, month, year, status)
        │
        └── FeedbackSubmission (id, cycle_id, reviewer_id, reviewee_id, submitted_at)
              │
              └── FeedbackScore (id, submission_id, parameter_id, score, comment)
```

### Key Assumptions & Architectural Decisions:
1. **Manager Hierarchy via Self-Reference**: `manager_id` on the `users` table handles arbitrary hierarchy depths without requiring extra join tables or complex role flags.
2. **Pre-created Cycle Submissions**: At the start of a feedback cycle, `feedback_submissions` records are pre-created for every reviewer-reviewee pair. Pending state is represented by `submitted_at IS NULL`, making pending status queries simple and performant.
3. **Data Isolation**: Multi-tenancy is enforced on the database query level by scoping queries with `company_id` from the verified JWT payload.
4. **HR Data Privacy**: HR users can monitor submission completion status across cycles without exposing specific performance ratings or score comments.

---

## 💻 Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (via Node 24 native `node:sqlite`)
- **Authentication**: JWT (JSON Web Tokens) & `bcrypt` password hashing
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (Fetch API)

---

## 🏃 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Data
Seeds test data for both Ashoka Textiles and Bright Path Consulting:
```bash
node server/seed.js
```

### 3. Start Server
```bash
node server/index.js
```

Open `http://localhost:3000` in your browser.

---

## 🔑 Demo Credentials

| Role | Email | Password | Company |
|---|---|---|---|
| Manager | `priya@ashoka.com` | `pass123` | Ashoka Textiles |
| Senior Manager | `rohan@ashoka.com` | `pass123` | Ashoka Textiles |
| Employee | `amit@ashoka.com` | `pass123` | Ashoka Textiles |
| HR Lead | `kavita@ashoka.com` | `pass123` | Ashoka Textiles |
| Founder | `arjun@brightpath.com` | `pass123` | Bright Path Consulting |
