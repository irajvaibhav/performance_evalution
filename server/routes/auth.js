const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const user = db
    .prepare("SELECT u.*, c.name as company_name FROM users u JOIN companies c ON c.id = u.company_id WHERE u.email = ?")
    .get(email.toLowerCase().trim());

  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  // Check if this user has any direct reports (makes them a manager in the UI)
  const reportCount = db
    .prepare("SELECT COUNT(*) as count FROM users WHERE manager_id = ?")
    .get(user.id);

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.company_id,
    companyName: user.company_name,
    isManager: reportCount.count > 0,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });

  res.json({ token, user: payload });
});

module.exports = router;
