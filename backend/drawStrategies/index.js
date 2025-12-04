const raw = require("./raw").generate;
const weighted = require("./weighted").generate;
const zscore = require("./zscore").generate;
const markov = require("./markov").generate;
const burst = require("./burst").generate;
const ai = require("./ai").generate;

module.exports = { raw, weighted, zscore, markov, burst, ai };
