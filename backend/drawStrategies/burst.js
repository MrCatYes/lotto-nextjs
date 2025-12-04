// burst.js : favorise les numéros qui viennent de sortir plusieurs fois récemment
module.exports.generate = ({ tirages, occurrences, type }) => {
  const recent = tirages.slice(0, 10).flatMap((t) => [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6]);
  const counts = {};
  recent.forEach((n) => (counts[n] = (counts[n] || 0) + 1));

  const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const result = [];

  while (result.length < 7) {
    const pick = parseInt(sorted[Math.floor(Math.random() * sorted.length)]);
    if (!result.includes(pick)) result.push(pick);
  }

  return result;
};
