// import-tirages.js
// Usage: node import-tirages.js path/to/tirages.csv

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

  // ----------------------------------------
  // 1️⃣ Création de la table si elle n'existe pas
  // ----------------------------------------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tirages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      num1 INTEGER NOT NULL,
      num2 INTEGER NOT NULL,
      num3 INTEGER NOT NULL,
      num4 INTEGER NOT NULL,
      num5 INTEGER NOT NULL,
      num6 INTEGER NOT NULL,
      bonus INTEGER,
      premium INTEGER DEFAULT 0
    );
  `);

  // ----------------------------------------
  // 2️⃣ Vider la table avant nouvel import
  // ----------------------------------------
  console.log("🧹 Suppression des tirages existants...");
  await db.exec(`DELETE FROM tirages;`);

  // ----------------------------------------
  // 3️⃣ Lecture du fichier CSV
  // ----------------------------------------
  console.log("📄 Lecture du fichier :", csvPath);
  const content = fs.readFileSync(csvPath, "utf8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    console.error("CSV vide ou sans lignes de données.");
    process.exit(1);
  }

  // Extract header columns
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);

  const hDate = idx("date");
  const h1 = idx("num1");
  const h2 = idx("num2");
  const h3 = idx("num3");
  const h4 = idx("num4");
  const h5 = idx("num5");
  const h6 = idx("num6");
  const hbonus = idx("bonus");
  const hpremium = idx("premium");

  if ([hDate, h1, h2, h3, h4, h5, h6].some((v) => v === -1)) {
    console.error("❌ Le CSV doit contenir les colonnes: date,num1,num2,num3,num4,num5,num6");
    process.exit(1);
  }

  // ----------------------------------------
  // 4️⃣ Préparation de l’insertion
  // ----------------------------------------
  const insertStmt = await db.prepare(`
    INSERT INTO tirages (date, num1, num2, num3, num4, num5, num6, bonus, premium)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;

  // Démarrer une transaction (100x plus rapide)
  await db.exec("BEGIN TRANSACTION");

  // ----------------------------------------
  // 5️⃣ Import ligne par ligne
  // ----------------------------------------
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());

    const date = cols[hDate];
    const num1 = parseInt(cols[h1]);
    const num2 = parseInt(cols[h2]);
    const num3 = parseInt(cols[h3]);
    const num4 = parseInt(cols[h4]);
    const num5 = parseInt(cols[h5]);
    const num6 = parseInt(cols[h6]);
    const bonus = hbonus !== -1 ? parseInt(cols[hbonus]) : null;
    const premium = hpremium !== -1 ? (parseInt(cols[hpremium]) ? 1 : 0) : 0;

    // Vérification du tirage complet
    if ([num1, num2, num3, num4, num5, num6].some((n) => Number.isNaN(n))) {
      console.warn("⚠️ Tirage ignoré (colonnes invalides) :", cols);
      continue;
    }

    await insertStmt.run(date, num1, num2, num3, num4, num5, num6, bonus, premium);
    count++;
  }

  // Fin transaction
  await db.exec("COMMIT");
  await insertStmt.finalize();

  // ----------------------------------------
  // 6️⃣ Résultat
  // ----------------------------------------
  console.log(`✅ Import terminé — ${count} tirages insérés.`);
  await db.close();
}

main().catch((err) => {
  console.error("❌ ERREUR RUNTIME :", err);
  process.exit(1);
});
