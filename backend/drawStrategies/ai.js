module.exports.generate = ({ tirages, occurrences, type, includeBonus = false, maxAttempts = 50 }) => {
  const recent = tirages.slice(0, 20).flatMap((t) => {
    const nums = [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6, t.num7];
    if (includeBonus) nums.push(t.bonus);
    return nums;
  });

  const counts = {};
  recent.forEach((n) => (counts[n] = (counts[n] || 0) + 1));

  const numbers = Object.keys(occurrences);
  const weighted = [];
  numbers.forEach((n) => {
    const weight = occurrences[n] + (counts[n] || 0);
    for (let i = 0; i < weight; i++) weighted.push(parseInt(n));
  });

  let result = [];
  let attempts = 0;

  switch (type) {
    case "equilibre":
      const mid = Math.floor(weighted.length / 2) || weighted.length;
      while (result.length < 7 && attempts < maxAttempts) {
        const pick = weighted[Math.floor(Math.random() * mid)];
        if (pick && !result.includes(pick)) result.push(pick);
        attempts++;
      }
      break;

    case "agressif":
      const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      while (result.length < 7 && attempts < maxAttempts) {
        const pick = parseInt(sorted[Math.floor(Math.random() * sorted.length)]);
        if (pick && !result.includes(pick)) result.push(pick);
        attempts++;
      }
      break;

    case "conservateur":
      const sortedLow = Object.keys(counts).sort((a, b) => counts[a] - counts[b]);
      while (result.length < 7 && attempts < maxAttempts) {
        const pick = parseInt(sortedLow[Math.floor(Math.random() * sortedLow.length)]);
        if (pick && !result.includes(pick)) result.push(pick);
        attempts++;
      }
      break;
  }

  // Si pas assez de numéros, remplir aléatoirement pour compléter 7
  const allNums = Array.from({ length: 50 }, (_, i) => i + 1);
  while (result.length < 7) {
    const pick = allNums[Math.floor(Math.random() * allNums.length)];
    if (!result.includes(pick)) result.push(pick);
  }

  return result;
};
