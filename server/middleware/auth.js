const jwt = require("jsonwebtoken");

const JWT_SECRET = "perf_eval_secret_key_2026";

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Malformed token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireHR(req, res, next) {
  if (req.user.role !== "hr") return res.status(403).json({ error: "HR access only" });
  next();
}

module.exports = { verifyToken, requireHR, JWT_SECRET };
