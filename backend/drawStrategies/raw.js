// raw.js : tirage aléatoire pur
module.exports.generate = ({ tirages, occurrences, type, includeBonus = false, maxAttempts = 50 }) => {
  const allNums = Array.from({ length: 50 }, (_, i) => i + 1);
  let result = [];
  let attempts = 0;

  switch (type) {
    case "equilibre":
      while (result.length < 7 && attempts < maxAttempts) {
        const pick = allNums[Math.floor(Math.random() * 40) + 5]; // milieu
        if (!result.includes(pick)) result.push(pick);
        attempts++;
      }
      break;

    case "agressif":
      while (result.length < 7 && attempts < maxAttempts) {
        const pick = allNums[Math.floor(Math.random() * 17) + 10]; // début + décalage
        if (!result.includes(pick)) result.push(pick);
        attempts++;
      }
      break;

    case "conservateur":
      while (result.length < 7 && attempts < maxAttempts) {
        const pick = allNums[Math.floor(Math.random() * 7)]; // petits numéros
        if (!result.includes(pick)) result.push(pick);
        attempts++;
      }
      break;
  }

  // remplir aléatoirement si nécessaire
  while (result.length < 7) {
    const pick = allNums[Math.floor(Math.random() * allNums.length)];
    if (!result.includes(pick)) result.push(pick);
  }

  return result.sort((a, b) => a - b);
};
