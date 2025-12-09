require("dotenv").config();
const express = require("express");
const { ApolloServer } = require("apollo-server-express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs").promises;
const path = require("path");
const { spawn } = require("child_process");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const winston = require("winston");
require("winston-daily-rotate-file");
const { openDB } = require("./db"); // ta connexion SQLite
// typeDefs & resolvers corrigés
const { typeDefs } = require("./graphql/schema");
const { resolvers, SECRET: RESOLVER_SECRET } = require("./graphql/resolvers");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || RESOLVER_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
const UPLOAD_MAX_SIZE = parseInt(process.env.UPLOAD_MAX_SIZE) || 5 * 1024 * 1024;
const UPLOAD_ALLOWED_TYPES = (process.env.UPLOAD_ALLOWED_TYPES || "text/csv,application/json").split(",");

/* ------------------------
   LOGGER
-------------------------*/
const transport = new winston.transports.DailyRotateFile({
  filename: path.join(__dirname, "logs", "import-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d",
  level: "info",
});

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}] ${message}`)
  ),
  transports: [transport, new winston.transports.Console()],
});

/* ------------------------
   FAUX STOCKAGE ADMINS (pour tests)
-------------------------*/
let admins = [{ username: "admin1", passwordHash: bcrypt.hashSync("SuperSecret123!", 10) }];

/* ------------------------
   JWT & MIDDLEWARE
-------------------------*/
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function authorizeAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied, admin only" });
  }
  next();
}

/* ------------------------
   MULTER CONFIG
-------------------------*/
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: UPLOAD_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!UPLOAD_ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error("Only CSV or JSON files are allowed"));
    }
    cb(null, true);
  },
});

/* ------------------------
   ENDPOINT LOGIN ADMIN
-------------------------*/
app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;
  const admin = admins.find((a) => a.username === username);
  if (!admin) return res.status(401).json({ error: "Invalid username or password" });

  const isValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isValid) return res.status(401).json({ error: "Invalid username or password" });

  const token = jwt.sign({ username: admin.username, role: "admin" }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token });
});

/* ------------------------
   ENDPOINT UPLOAD CSV ADMIN
-------------------------*/
app.post("/admin/import", authenticate, authorizeAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const filePath = path.resolve(req.file.path);

  try {
    const child = spawn("node", ["import-tirages.js", filePath], { cwd: __dirname });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", async (code) => {
      try {
        await fs.unlink(filePath);
      } catch (e) {
        logger.warn(`Failed to delete file: ${e}`);
      }

      const logEntry = `${new Date().toISOString()} | Admin: ${req.user.username} | File: ${
        req.file.originalname
      } | Status: ${code === 0 ? "Success" : "Error"}`;
      logger.info(logEntry);

      if (code !== 0) return res.status(500).json({ error: stderr || `Exited with code ${code}` });
      res.json({ ok: true, out: stdout });
    });
  } catch (err) {
    try {
      await fs.unlink(filePath);
    } catch (e) {}
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------
   GRAPHQL
-------------------------*/
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    let user = null;
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      try {
        user = jwt.verify(authHeader.slice(7), JWT_SECRET);
      } catch (e) {}
    }
    return { user, db: openDB }; // openDB accessible depuis resolvers
  },
});

async function startApollo() {
  await server.start();
  server.applyMiddleware({ app });
}
startApollo();

/* ------------------------
   ERROR HANDLER
-------------------------*/
app.use((err, req, res, next) => {
  logger.error(err.stack || err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

/* ------------------------
   START SERVER
-------------------------*/
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
});
