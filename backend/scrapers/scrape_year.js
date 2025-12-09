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
// Robust scrape for 2025 (replace existing scrapeDate2025)
async function scrapeDate2025(browser, dateStr) {
  const page = await browser.newPage();
  const url = `https://loteries.lotoquebec.com/fr/loteries/lotto-max-resultats?date=${dateStr}`;

  console.log(`➡️ Scraping 2025 : ${dateStr} -> ${url}`);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 0 });

  // Try several selectors, with retries
  const candidateSelectors = [
    ".lqZoneResultatsProduit .numeros", // new format
    ".numeros", // generic
    ".lqZoneStructuresDeLots .numeros", // alt
    "table.tbl-resultats tbody tr", // fallback to table rows
    "table tbody tr", // older fallback
  ];

  // wait for any selector to appear (with retries)
  let foundSelector = null;
  for (let attempt = 0; attempt < 4 && !foundSelector; attempt++) {
    for (const sel of candidateSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 4000 });
        foundSelector = sel;
        break;
      } catch (e) {
        // not found yet -> continue
      }
    }
    if (!foundSelector) {
      // small wait before next attempt
      await page.waitForTimeout(800);
    }
  }

  if (!foundSelector) {
    // Save a bit of HTML for debugging and return
    const snap = await page.content();
    console.error(`❌ Aucun sélecteur utile trouvé pour ${dateStr}. Sauvegarde HTML pour debug.`);
    // write short snapshot to console (or to a log file if you prefer)
    console.log("---- HTML SNAPSHOT START ----");
    console.log(snap.slice(0, 4000));
    console.log("---- HTML SNAPSHOT END ----");
    await page.close();
    return;
  }

  // Evaluate depending on selector found
  const data = await page.evaluate((sel) => {
    const parseNumsFromNode = (node) =>
      [...node.querySelectorAll(".num, span")]
        .map((n) => parseInt(n.innerText.replace(/\D/g, ""), 10))
        .filter((n) => !Number.isNaN(n));

    // If it's the new structured zone
    if (sel.includes("lqZoneResultatsProduit") || sel === ".numeros" || sel.includes("lqZoneStructuresDeLots")) {
      const main = document.querySelector(sel);
      if (!main) return null;

      // principal numbers: first 7 .num
      let nums = parseNumsFromNode(main).slice(0, 7);
      // try to get complementary if present
      const comp = main.querySelector(".num.complementaire") || main.querySelector(".complementaire, .num-sep + .num");
      const bonus = comp ? parseInt(comp.innerText.replace(/\D/g, ""), 10) : null;

      // maxmillions: try common containers
      const maxMillions = [];
      // some pages use .lqZoneStructureDeLots / structureN
      const mmContainers = document.querySelectorAll(
        ".lqZoneStructureDeLots .structure2, .ensembleMaxNumeros .numeros, .lqMaxmillions .numeros, .lqZoneStructureDeLots .numeros"
      );
      if (mmContainers && mmContainers.length) {
        mmContainers.forEach((c) => {
          const vals = parseNumsFromNode(c).slice(0, 7);
          if (vals.length === 7) maxMillions.push(vals);
        });
      } else {
        // fallback: sequential divs after "Maxmillions" label
        const allDivs = [...document.querySelectorAll("div")];
        const mmLabelIndex = allDivs.findIndex((d) => /maxmillions/i.test(d.innerText || ""));
        if (mmLabelIndex >= 0) {
          for (let i = mmLabelIndex + 1; i < Math.min(allDivs.length, mmLabelIndex + 30); i++) {
            const vals = parseNumsFromNode(allDivs[i]).slice(0, 7);
            if (vals.length === 7) maxMillions.push(vals);
          }
        }
      }

      return { nums, bonus, maxMillions };
    }

    // If it's a table row format
    if (sel.includes("table")) {
      // try to find the row matching the current page date (URL may include it)
      const rows = [...document.querySelectorAll("table tbody tr")];
      if (!rows.length) return null;

      // find first data row (skip header)
      const row = rows.find((r) => !r.classList.contains("titre") && !r.querySelector("th")) || rows[0];
      const td = row.querySelectorAll("td")[1] || row;
      // principal is usually the second div or the first set of spans
      const principalDiv = td.querySelector("div:nth-of-type(2)") || td;
      const nums = parseNumsFromNode(principalDiv).slice(0, 7);
      // bonus might be in parentheses span
      const bonusSpan = principalDiv.querySelector("span:last-of-type");
      const bonus = bonusSpan ? parseInt(bonusSpan.innerText.replace(/\D/g, ""), 10) : null;

      const maxMillions = [];
      // next divs after "Maxmillions"
      const labels = [...td.querySelectorAll("div")];
      const maxIdx = labels.findIndex((d) => /maxmillions/i.test(d.innerText || ""));
      if (maxIdx >= 0) {
        for (let i = maxIdx + 1; i < labels.length; i++) {
          const vals = parseNumsFromNode(labels[i]).slice(0, 7);
          if (vals.length === 7) maxMillions.push(vals);
        }
      }

      return { nums, bonus, maxMillions };
    }

    return null;
  }, foundSelector);

  if (!data || !data.nums || data.nums.length < 7) {
    console.log(`❌ Extraction n'a pas retourné de nombres valides pour ${dateStr}`);
    await page.close();
    return;
  }

  // anti-doublon: check if date exists
  const exists = await new Promise((res) =>
    db.get("SELECT id FROM tirages WHERE date = ?", [dateStr], (e, row) => res(!!row))
  );
  if (exists) {
    console.log(`   - Tirage ${dateStr} déjà présent, on saute.`);
    await page.close();
    return;
  }

  // insert
  const [n1, n2, n3, n4, n5, n6, n7] = data.nums;
  const bonus = data.bonus ?? null;

  const tirageId = await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO tirages (date, num1, num2, num3, num4, num5, num6, num7, bonus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dateStr, n1, n2, n3, n4, n5, n6, n7, bonus],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });

  for (const mm of data.maxMillions || []) {
    if (mm.length !== 7) continue;
    db.run(
      `INSERT INTO maxmillions (tirage_id, num1, num2, num3, num4, num5, num6, num7)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tirageId, ...mm]
    );
  }

  console.log(` ✔ Tirage ${dateStr} inséré (id=${tirageId}) — ${data.maxMillions?.length || 0} maxmillions`);
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
  //   for (let year = 2009; year <= currentYear - 1; year++) {
  //     try {
  //       await scrapeYear(browser, year);
  //     } catch (e) {
  //       console.error("Erreur scrape année", year, e.message);
  //     }
  //   }

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
