// markov.js : basé sur la transition entre tirages précédents
module.exports.generate = ({ tirages, occurrences, type, includeBonus = false, maxAttempts = 50 }) => {
  const last = tirages[0] || {};
  const nums = [last.num1, last.num2, last.num3, last.num4, last.num5, last.num6, last.num7];
  if (includeBonus && last.bonus) nums.push(last.bonus);

  let result = [];
  let attempts = 0;

  switch (type) {
    case "equilibre":
      while (result.length < 7 && attempts < maxAttempts) {
        const candidate = nums[Math.floor(Math.random() * nums.length)];
        if (candidate && !result.includes(candidate)) result.push(candidate);
        attempts++;
      }
      break;
    case "agressif":
      while (result.length < 7 && attempts < maxAttempts) {
        const candidate = nums[Math.floor(Math.random() * nums.length)] + Math.floor(Math.random() * 5 - 2);
        if (candidate >= 1 && candidate <= 50 && !result.includes(candidate)) result.push(candidate);
        attempts++;
      }
      break;
    case "conservateur":
      while (result.length < 7 && attempts < maxAttempts) {
        const candidate = nums[Math.floor(Math.random() * nums.length)] + Math.floor(Math.random() * 3 - 1);
        if (candidate >= 1 && candidate <= 50 && !result.includes(candidate)) result.push(candidate);
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
