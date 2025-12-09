const axios = require("axios");
const cheerio = require("cheerio");
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./loto.db");

async function scrapeToday() {
  const today = new Date();
  const year = today.getFullYear();

  const url =
    "https://loteries.lotoquebec.com/fr/loteries/lotto-max?widget=resultats-anterieurs&noProduit=223&annee=" + year;

  const res = await axios.get(url);
  const $ = cheerio.load(res.data);

  const todayStr = today.toLocaleDateString("fr-CA"); // format AAAA-MM-JJ

  let found = false;

  $(".item.resultats").each((_, el) => {
    const dateText = $(el).find(".date").text().trim();

    // Convertit en AAAA-MM-JJ
    const dateObj = new Date(dateText);
    const formatted = dateObj.toLocaleDateString("fr-CA");

    if (formatted !== todayStr) return; // pas la bonne date

    found = true;

    // Boules principales
    const nums = [];
    $(el)
      .find(".boules .boule")
      .each((_, b) => nums.push(parseInt($(b).text().trim())));

    if (nums.length < 8) return;
    const [num1, num2, num3, num4, num5, num6, num7, bonus] = nums;

    // Vérifier doublon
    db.get(`SELECT id FROM tirages WHERE date = ?`, [formatted], (err, row) => {
      if (row) {
        console.log("Tirage du jour déjà en BD.");
        return;
      }

      // Insérer
      db.run(
        `INSERT INTO tirages (date, num1, num2, num3, num4, num5, num6, num7, bonus)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [formatted, num1, num2, num3, num4, num5, num6, num7, bonus],
        function (err) {
          if (err) return console.error(err);

          const tirageId = this.lastID;

          // Maxmillions
          $(el)
            .find(".maxmillions .boules")
            .each((_, mmBlock) => {
              const mmNums = [];
              $(mmBlock)
                .find(".boule")
                .each((_, b) => mmNums.push(parseInt($(b).text().trim())));

              if (mmNums.length === 7) {
                db.run(
                  `INSERT INTO maxmillions (tirage_id, num1, num2, num3, num4, num5, num6, num7)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [tirageId, ...mmNums]
                );
              }
            });
        }
      );
    });
  });

  if (!found) {
    console.log("Aucun tirage aujourd’hui (aucune publication disponible).");
  }
}

module.exports = scrapeToday;
