// weighted.js : plus probable si déjà sorti souvent
module.exports.generate = ({ tirages, occurrences, type }) => {
  const numbers = Object.keys(occurrences);
  const weighted = [];
  numbers.forEach((n) => {
    for (let i = 0; i < occurrences[n]; i++) weighted.push(parseInt(n));
  });

  const result = [];
  while (result.length < 7) {
    const pick = weighted[Math.floor(Math.random() * weighted.length)];
    if (!result.includes(pick)) result.push(pick);
  }

  return result;
};
