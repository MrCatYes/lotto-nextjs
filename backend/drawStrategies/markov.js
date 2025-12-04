// markov.js : basé sur la transition entre tirages précédents
module.exports.generate = ({ tirages, occurrences, type }) => {
  if (!tirages.length) return Array.from({ length: 7 }, () => Math.floor(Math.random() * 50) + 1);

  const last = tirages[0];
  const nums = [last.num1, last.num2, last.num3, last.num4, last.num5, last.num6];
  const pick = [];

  while (pick.length < 7) {
    const candidate = nums[Math.floor(Math.random() * nums.length)] + Math.floor(Math.random() * 5 - 2);
    if (candidate >= 1 && candidate <= 50 && !pick.includes(candidate)) pick.push(candidate);
  }

  return pick;
};
