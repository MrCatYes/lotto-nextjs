const cron = require("node-cron");
const scrapeToday = require("./scrapers/scrape_today");

// CRON : chaque jour à 7h du matin
cron.schedule("0 7 * * *", async () => {
  console.log("[CRON] Vérification du tirage du jour...");
  await scrapeToday();
});
