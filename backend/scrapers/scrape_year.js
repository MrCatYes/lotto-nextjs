// backend/scrapers/scrape_years_fixed.js
const puppeteer = require("puppeteer");
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./lotto.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS tirages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    num1 INTEGER, num2 INTEGER, num3 INTEGER, num4 INTEGER,
    num5 INTEGER, num6 INTEGER, num7 INTEGER,
    bonus INTEGER,
    premium INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS maxmillions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tirage_id INTEGER NOT NULL,
    num1 INTEGER, num2 INTEGER, num3 INTEGER, num4 INTEGER,
    num5 INTEGER, num6 INTEGER, num7 INTEGER,
    FOREIGN KEY (tirage_id) REFERENCES tirages(id)
  )`);
});

const BASE =
  "https://loteries.lotoquebec.com/fr/loteries/lotto-max-resultats?widget=resultats-anterieurs&noProduit=223&annee=";

async function scrapeYear(browser, year) {
  const page = await browser.newPage();
  const url = BASE + year;
  console.log("➡️ Scraping année :", year);

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  // attendre qu'au moins une ligne de la table soit présente (skip header)
  try {
    await page.waitForSelector("table tbody tr", { timeout: 15000 });
  } catch (err) {
    console.log(`❌ Aucun résultat (table) trouvé pour ${year}`);
    await page.close();
    return;
  }

  const tirages = await page.$$eval("table tbody tr", (rows) => {
    return rows
      .map((row) => {
        if (row.classList.contains("titre") || row.querySelector("th")) return null;

        const dateNode = row.querySelector(".date");
        const date = dateNode ? dateNode.innerText.trim() : null;
        if (!date) return null;

        // ----------- DETECTION FORMAT 2024 -----------

        const tds = row.querySelectorAll("td");
        if (tds.length >= 2) {
          const td = tds[1]; // où sont tous les numéros

          const divs = [...td.querySelectorAll("div")].map((d) => d.innerText.trim());

          const idxPrincipal = divs.findIndex((x) => x.toLowerCase().includes("tirage principal"));

          if (idxPrincipal !== -1) {
            // le div suivant = les numéros principaux
            const principalSpans = [...td.querySelectorAll("div")][idxPrincipal + 1].querySelectorAll("span");

            const nums = [...principalSpans]
              .map((s) => parseInt(s.innerText.trim(), 10))
              .filter((n) => !isNaN(n))
              .slice(0, 7);

            const bonus = (() => {
              const bonusSpan = [...principalSpans][7]; // car format "(XX)"
              return bonusSpan ? parseInt(bonusSpan.innerText.trim(), 10) : null;
            })();

            // ----- Maxmillions -----
            const maxMillions = [];
            const maxIndex = divs.findIndex((x) => x.toLowerCase().includes("maxmillions"));

            if (maxIndex !== -1) {
              const maxDivs = [...td.querySelectorAll("div")].slice(maxIndex + 1);

              maxDivs.forEach((maxDiv) => {
                const spans = [...maxDiv.querySelectorAll("span")].map((s) => parseInt(s.innerText.trim(), 10));
                if (spans.length === 7) maxMillions.push(spans);
              });
            }

            return { date, nums, bonus, maxMillions };
          }
        }

        // ----------- ANCIEN FORMAT (2009–2023) -----------
        const principal = row.querySelector(".numerosGangnants.principal");
        if (!principal) return null;

        const spans = [...principal.querySelectorAll("span")].map((s) => parseInt(s.innerText.trim(), 10));

        const nums = spans.slice(0, 7);
        const bonus = spans[7] || null;

        const maxMillions = [];
        row.querySelectorAll(".numerosGangnants.maximillions").forEach((mm) => {
          const vals = [...mm.querySelectorAll("span")].map((s) => parseInt(s.innerText.trim(), 10));
          if (vals.length === 7) maxMillions.push(vals);
        });

        return { date, nums, bonus, maxMillions };
      })
      .filter(Boolean);
  });

  console.log(` → ${tirages.length} tirages extraits pour ${year}`);

  for (const t of tirages) {
    if (!t || !t.date) continue;

    // protection anti-doublon : vérifier si la date existe
    const exists = await new Promise((resolve) =>
      db.get("SELECT id FROM tirages WHERE date = ?", [t.date], (err, row) => resolve(!!row))
    );
    if (exists) {
      console.log(`   - Tirage ${t.date} déjà présent, on saute.`);
      continue;
    }

    const [n1, n2, n3, n4, n5, n6, n7] = t.nums;
    const bonus = t.bonus ?? null;

    const tirageId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO tirages (date, num1, num2, num3, num4, num5, num6, num7, bonus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.date, n1, n2, n3, n4, n5, n6, n7, bonus],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });

    for (const mm of t.maxMillions) {
      db.run(
        `INSERT INTO maxmillions (tirage_id, num1, num2, num3, num4, num5, num6, num7)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [tirageId, ...mm],
        (err) => {
          if (err) console.error("Erreur insert maxmillions:", err.message);
        }
      );
    }
  }

  await page.close();
}

// ------------------ SCRAPER SPECIAL 2025 (NOUVELLE URL) ------------------
async function scrapeDate2025(browser, dateStr) {
  const page = await browser.newPage();
  const url = `https://loteries.lotoquebec.com/fr/lotto-max/resultats/${dateStr}`;

  console.log(`➡️ Scraping (2025) : ${dateStr}`);

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  try {
    await page.waitForSelector(".numeros", { timeout: 15000 });
  } catch {
    console.log(`❌ Aucun tirage trouvé pour ${dateStr}`);
    await page.close();
    return;
  }

  const data = await page.evaluate(() => {
    const main = document.querySelector(".numeros");
    if (!main) return null;

    const nums = [...main.querySelectorAll(".num")].map((n) => parseInt(n.innerText.trim(), 10)).slice(0, 7);

    const bonus = parseInt(main.querySelector(".num.complementaire")?.innerText || "0", 10);

    const maxMillions = [];
    document.querySelectorAll(".ensembleMaxNumeros .numeros").forEach((mm) => {
      const vals = [...mm.querySelectorAll(".num")].map((n) => parseInt(n.innerText.trim(), 10));
      if (vals.length === 7) maxMillions.push(vals);
    });

    return { nums, bonus, maxMillions };
  });

  if (data) {
    const [n1, n2, n3, n4, n5, n6, n7] = data.nums;

    const tirageId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO tirages (date, num1, num2, num3, num4, num5, num6, num7, bonus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dateStr, n1, n2, n3, n4, n5, n6, n7, data.bonus],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });

    if (tirageId) {
      for (const mm of data.maxMillions) {
        db.run(
          `INSERT INTO maxmillions (tirage_id, num1, num2, num3, num4, num5, num6, num7)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [tirageId, ...mm]
        );
      }
    }
  }

  await page.close();
}

function getTuesdaysAndFridays(year) {
  const dates = [];
  for (let m = 0; m < 12; m++) {
    const days = new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const date = new Date(year, m, d);
      const weekday = date.getDay();
      if (weekday === 2 || weekday === 5) {
        const y = date.getFullYear();
        const mm = String(m + 1).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        dates.push(`${y}-${mm}-${dd}`);
      }
    }
  }
  return dates;
}

(async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });

  const currentYear = new Date().getFullYear();
  console.log("test " + currentYear);
  for (let year = 2009; year <= currentYear - 1; year++) {
    try {
      await scrapeYear(browser, year);
    } catch (e) {
      console.error("Erreur scrape année", year, e.message);
    }
  }

  // ---- Scraper 2025 ----
  if (currentYear === 2025) {
    console.log("➡️ Mode spécial 2025 activé");
    const dates = getTuesdaysAndFridays(2025);
    for (const d of dates) {
      await scrapeDate2025(browser, d);
    }
  }

  await browser.close();
  db.close();
  console.log("✅ Scraping terminé !");
})();
