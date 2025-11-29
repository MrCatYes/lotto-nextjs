const { openDB } = require("../db");

const resolvers = {
  Query: {
    tirages: async (_, { limit = 5, premium = false }) => {
      const db = await openDB();
      let query = "SELECT * FROM tirages";
      let params = [];

      if (!premium) {
        query += " WHERE premium=0";
      }

      query += " ORDER BY date DESC LIMIT ?";
      params.push(limit);

      const rows = await db.all(query, params);
      return rows;
    },
  },
  Mutation: {
    calculerProbabilite: async (_, { numeros, premium = false }) => {
      const db = await openDB();
      let query = "SELECT * FROM tirages";
      let params = [];
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
