// zscore.js : favorise numéros éloignés de la moyenne
module.exports.generate = ({ tirages, occurrences, type, includeBonus = false, maxAttempts = 50 }) => {
  const mean = Object.values(occurrences).reduce((a, b) => a + b, 0) / Math.max(Object.keys(occurrences).length, 1);
  const zscores = {};
  Object.entries(occurrences).forEach(([n, c]) => {
    zscores[n] = Math.abs(c - mean);
  });

  const sorted = Object.keys(zscores).sort((a, b) => zscores[b] - zscores[a]);

  let result = [];
  let attempts = 0;

  switch (type) {
    case "equilibre":
      while (result.length < 7 && attempts < maxAttempts) {
        const pick = parseInt(sorted[Math.floor(sorted.length / 2 + Math.random() * 3 - 1)]);
        if (pick && !result.includes(pick)) result.push(pick);
        attempts++;
      }
      break;
    case "agressif":
      while (result.length < 7 && attempts < maxAttempts) {
        const pick = parseInt(sorted[Math.floor(Math.random() * sorted.length)]);
        if (pick && !result.includes(pick)) result.push(pick);
        attempts++;
      }
      break;
    case "conservateur":
      while (result.length < 7 && attempts < maxAttempts) {
        const pick = parseInt(sorted[Math.floor(sorted.length / 3)]);
        if (pick && !result.includes(pick)) result.push(pick);
        attempts++;
      }
      break;
  }

  const allNums = Array.from({ length: 50 }, (_, i) => i + 1);
  while (result.length < 7) {
    const pick = allNums[Math.floor(Math.random() * allNums.length)];
    if (!result.includes(pick)) result.push(pick);
  }
  return result.sort((a, b) => a - b);
};
