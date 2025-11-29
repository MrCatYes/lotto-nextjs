const { openDB } = require("../db");

const resolvers = {
  Query: {
    tirages: async (_, { limit = 5, premium = false }) => {
      const db = await openDB();
      let query = "SELECT * FROM tirages";
      const params = [];
      if (!premium) query += " WHERE premium=0";
      query += " ORDER BY date DESC LIMIT ?";
      params.push(limit);
      const rows = await db.all(query, params);
      return rows;
    },

    occurrences: async (_, { premium = false }) => {
      const db = await openDB();
      let query = "SELECT num1,num2,num3,num4,num5 FROM tirages";
      const params = [];
      if (!premium) query += " WHERE premium=0";
      const rows = await db.all(query, params);

      // compter occurrences sur 1..max (on cherche max number dynamiquement)
      const counts = {};
      rows.forEach((r) => {
        [r.num1, r.num2, r.num3, r.num4, r.num5].forEach((n) => {
          if (!n) return;
          counts[n] = (counts[n] || 0) + 1;
        });
      });

      // transformer en tableau trié par number
      const result = Object.keys(counts)
        .map((k) => ({ number: parseInt(k), count: counts[k] }))
        .sort((a, b) => a.number - b.number);

      return result;
    },
  },

  Mutation: {
    calculerProbabilite: async (_, { numeros, premium = false }) => {
      const db = await openDB();
      let query = "SELECT num1,num2,num3,num4,num5,bonus FROM tirages";
      const params = [];
      if (!premium) query += " WHERE premium=0";
      const rows = await db.all(query, params);
      let count = 0;
      rows.forEach((t) => {
        const tirageNums = [t.num1, t.num2, t.num3, t.num4, t.num5, t.bonus];
        if (numeros.every((n) => tirageNums.includes(n))) count++;
      });
      return { probabilite: rows.length > 0 ? count / rows.length : 0 };
    },
  },
};

module.exports = { resolvers };
