// raw.js : tirage aléatoire pur
module.exports.generate = ({ tirages, occurrences, type }) => {
  const allNums = Array.from({ length: 50 }, (_, i) => i + 1);
  const shuffled = allNums.sort(() => Math.random() - 0.5);

  switch (type) {
    case "conservateur":
      return shuffled.slice(0, 7);
    case "agressif":
      return shuffled.slice(10, 17);
    default: // équilibré
      return shuffled.slice(5, 12);
  }
};
