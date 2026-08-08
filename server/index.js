const express = require("express");
const path = require("path");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const feedbackRoutes = require("./routes/feedback");
const hrRoutes = require("./routes/hr");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/auth", authRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/hr", hrRoutes);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
