const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { openDB } = require("../db");
const {
  raw: drawRaw,
  weighted: drawWeighted,
  zscore: drawZScore,
  markov: drawMarkov,
  burst: drawBurst,
  ai: drawAI,
} = require("../drawStrategies");
const SECRET = "ton_secret_jwt"; // à mettre en variable d'environnement
let admins = []; // mémoire pour test

const resolvers = {
  Query: {
    admins: () => admins,
    tirages: async (_, { limit = 10, offset = 0, premium = false, date, year, month }, context) => {
      const db = await context.db();

      let query = `
        SELECT *
        FROM tirages
        WHERE 1=1
      `;
      const params = [];

      if (!premium) query += " AND premium = 0";

      if (date) {
        query += " AND date = ?";
        params.push(date);
      }

      if (year) {
        query += " AND strftime('%Y', date) = ?";
        params.push(String(year));
      }

      if (month !== undefined && month !== null) {
        query += " AND strftime('%m', date) = ?";
        params.push(String(month + 1).padStart(2, "0"));
      }

      query += " ORDER BY date DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      return await db.all(query, params);
    },

    occurrences: async (_, { premium = false }) => {
      const db = await openDB();

      premium = !!premium;
      let query = "SELECT num1,num2,num3,num4,num5,num6 FROM tirages";
      const params = [];
      if (!premium) query += " WHERE premium=0";

      const rows = await db.all(query, params);

      const counts = {};
      rows.forEach((r) => {
        [r.num1, r.num2, r.num3, r.num4, r.num5, r.num6].forEach((n) => {
          if (!n) return;
          counts[n] = (counts[n] || 0) + 1;
        });
      });

      return Object.keys(counts)
        .map((k) => ({ number: parseInt(k), count: counts[k] }))
        .sort((a, b) => a.number - b.number);
    },

    availableDates: async (_, { premium = false }, context) => {
      const db = await context.db();
      let query = "SELECT DISTINCT date FROM tirages";
      const params = [];
      if (!premium) query += " WHERE premium = 0";
      const rows = await db.all(query, params);
      // Retourner un tableau de strings "YYYY-MM-DD"
      return rows.map((r) => r.date);
    },
  },

  Mutation: {
    createAdmin: async (_, { username, password }) => {
      const hashed = await bcrypt.hash(password, 10);
      const newAdmin = { id: admins.length + 1, username, password: hashed };
      admins.push(newAdmin);
      return { id: newAdmin.id, username: newAdmin.username };
    },

    loginAdmin: async (_, { username, password }) => {
      const admin = admins.find((a) => a.username === username);
      if (!admin) throw new Error("Admin introuvable");

      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) throw new Error("Mot de passe incorrect");

      const token = jwt.sign({ id: admin.id, username: admin.username, role: "admin" }, SECRET, { expiresIn: "1d" });

      return { token, admin: { id: admin.id, username: admin.username } };
    },

    calculerProbabilite: async (_, { numeros, premium = false }) => {
      const db = await openDB();

      premium = !!premium;
      numeros = numeros.map(Number);

      let query = "SELECT num1,num2,num3,num4,num5,num6,bonus FROM tirages";
      const params = [];
      if (!premium) query += " WHERE premium=0";

      const rows = await db.all(query, params);

      let count = 0;
      rows.forEach((t) => {
        const tirageNums = [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6, t.bonus];
        if (numeros.every((n) => tirageNums.includes(n))) count++;
      });

      return { probabilite: rows.length > 0 ? count / rows.length : 0 };
    },

    simulateDraw: async (_, { mode, premium = false }, context) => {
      const db = await context.db();

      // Limite le nombre de tirages récents pour éviter surcharge
      const tirages = await db.all(
        "SELECT num1,num2,num3,num4,num5,num6,bonus FROM tirages WHERE premium=? ORDER BY date DESC LIMIT 100",
        [premium ? 1 : 0]
      );

      let strategyFn;
      switch (mode) {
        case "raw":
          strategyFn = drawRaw;
          break;
        case "weighted":
          strategyFn = drawWeighted;
          break;
        case "zscore":
          strategyFn = drawZScore;
          break;
        case "markov":
          strategyFn = drawMarkov;
          break;
        case "burst":
          strategyFn = drawBurst;
          break;
        case "ai":
          strategyFn = drawAI;
          break;
        default:
          strategyFn = drawRaw;
      }

      const strategies = ["equilibre", "agressif", "conservateur"];
      const results = strategies.reduce((acc, strategy) => {
        const tirage = strategyFn({
          tirages,
          occurrences: [],
          type: strategy,
          includeBonus: false,
          maxAttempts: 50,
        });
        acc[strategy] = tirage.sort((a, b) => a - b); // 🔹 tri croissant
        return acc;
      }, {});

      return results;
    },
  },
};

module.exports = { resolvers, SECRET };
