// ai.js : exemple simple, mélange de weighted + burst
module.exports.generate = ({ tirages, occurrences, type }) => {
  const recent = tirages.slice(0, 20).flatMap((t) => [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6]);
  const counts = {};
  recent.forEach((n) => (counts[n] = (counts[n] || 0) + 1));

  const numbers = Object.keys(occurrences);
  const weighted = [];
  numbers.forEach((n) => {
    const weight = occurrences[n] + (counts[n] || 0);
    for (let i = 0; i < weight; i++) weighted.push(parseInt(n));
  });

  const result = [];
  while (result.length < 7) {
    const pick = weighted[Math.floor(Math.random() * weighted.length)];
    if (!result.includes(pick)) result.push(pick);
  }

  return result;
};
