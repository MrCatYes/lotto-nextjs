// import-tirages.js
// Usage: node import-tirages.js path\to\tirages.csv
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");

async function main() {
  const argv = process.argv;
  if (!argv[2]) {
    console.error("Usage: node import-tirages.js path/to/tirages.csv");
    process.exit(1);
  }
  const csvPath = path.resolve(argv[2]);
  if (!fs.existsSync(csvPath)) {
    console.error("Fichier non trouvé:", csvPath);
    process.exit(1);
  }

  const db = await open({
    filename: "./lotto.db",
    driver: sqlite3.Database,
  });

  // Create table if not exists (with premium field)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tirages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      num1 INTEGER,
      num2 INTEGER,
      num3 INTEGER,
      num4 INTEGER,
      num5 INTEGER,
      bonus INTEGER,
      premium INTEGER DEFAULT 0
    );
  `);

  const content = fs.readFileSync(csvPath, "utf8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    console.error("CSV vide ou sans lignes de données.");
    process.exit(1);
  }

  // Parse header
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name) => {
    const i = header.indexOf(name);
    return i === -1 ? null : i;
  };

  const hDate = idx("date");
  const h1 = idx("num1");
  const h2 = idx("num2");
  const h3 = idx("num3");
  const h4 = idx("num4");
  const h5 = idx("num5");
  const hbonus = idx("bonus");
  const hpremium = idx("premium"); // optional

  if ([hDate, h1, h2, h3, h4, h5, hbonus].some((v) => v === null)) {
    console.error("Le CSV doit contenir au moins les colonnes: date,num1,num2,num3,num4,num5,bonus");
    process.exit(1);
  }

  const insertStmt = await db.prepare(`
    INSERT INTO tirages (date, num1, num2, num3, num4, num5, bonus, premium)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length < header.length) continue;
    const date = cols[hDate];
    const num1 = parseInt(cols[h1]) || null;
    const num2 = parseInt(cols[h2]) || null;
    const num3 = parseInt(cols[h3]) || null;
    const num4 = parseInt(cols[h4]) || null;
    const num5 = parseInt(cols[h5]) || null;
    const bonus = parseInt(cols[hbonus]) || null;
    const premium = hpremium !== null ? (parseInt(cols[hpremium]) ? 1 : 0) : 0;

    // simple validation
    if (![num1, num2, num3, num4, num5].every((n) => typeof n === "number" && !Number.isNaN(n))) continue;

    await insertStmt.run(date, num1, num2, num3, num4, num5, bonus, premium);
    count++;
  }

  await insertStmt.finalize();
  console.log(`Import terminé — ${count} tirages insérés.`);
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
