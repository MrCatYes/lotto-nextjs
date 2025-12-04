// zscore.js : favorise numéros éloignés de la moyenne
module.exports.generate = ({ tirages, occurrences, type }) => {
  const mean = Object.values(occurrences).reduce((a, b) => a + b, 0) / Object.keys(occurrences).length;
  const zscores = {};
  Object.entries(occurrences).forEach(([n, c]) => {
    zscores[n] = Math.abs(c - mean);
  });

  const sorted = Object.keys(zscores).sort((a, b) => zscores[b] - zscores[a]);

  switch (type) {
    case "conservateur":
      return sorted.slice(-7).map(Number);
    case "agressif":
      return sorted.slice(0, 7).map(Number);
    default:
      return sorted.slice(3, 10).map(Number);
  }
};
