const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

async function openDB() {
  return open({
    filename: "./scrapers/lotto.db",
    driver: sqlite3.Database,
  });
}

module.exports = { openDB };
