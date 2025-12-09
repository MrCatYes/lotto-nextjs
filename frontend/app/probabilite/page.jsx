"use client";

import { useState, useMemo } from "react";
import { ApolloClient, InMemoryCache, HttpLink, gql } from "@apollo/client";

const client = new ApolloClient({
  link: new HttpLink({ uri: "http://localhost:4000/graphql" }),
  cache: new InMemoryCache(),
});

// helper combinatorics
function nCr(n, r) {
  if (r < 0 || r > n) return 0;
  if (r === 0) return 1;
  r = Math.min(r, n - r);
  let num = 1, den = 1;
  for (let i = 0; i < r; i++) { num *= (n - i); den *= (i + 1); }
  return num / den;
}

export default function ProbPage() {
  const [selection, setSelection] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [result, setResult] = useState(null);
  const [simCount, setSimCount] = useState(10000);

  // basic combinatorial probability for k matching numbers among 6 from 49 (example)
  const combinatorial = (selectedCount) => {
    // assuming standard lotto: draw 6 from 49
    const totalComb = nCr(49,6);
    // Nº of combos matching exactly m of selected? For full combination exact match:
    if (selectedCount !== 6) return null;
    // probability to match exactly that combination = 1 / totalComb
    return 1 / totalComb;
  };

  const calcFromServer = async (nums) => {
    const res = await client.mutate({
      mutation: gql`
        mutation($nums:[Int]!, $premium:Boolean) {
          calculerProbabilite(numeros:$nums, premium:$premium) { probabilite }
        }
      `,
      variables: { nums, premium: isPremium }
    });
    return res.data.calculerProbabilite.probabilite;
  };

  const runSimulation = async (nums) => {
    // Monte-Carlo: simulate many draws using historical weights (simple uniform draw here)
    const sims = Number(simCount) || 10000;
    let hits = 0;
    const chosen = nums.map(n => Number(n));
    for (let s = 0; s < sims; s++) {
      // generate 6 unique numbers 1..49
      const pool = Array.from({length:49}, (_,i) => i+1);
      const draw = [];
      for (let k = 0; k < 6; k++) {
        const idx = Math.floor(Math.random() * pool.length);
        draw.push(pool.splice(idx,1)[0]);
      }
      if (chosen.every(c => draw.includes(c))) hits++;
    }
    return hits / sims;
  };

  const onCalculate = async () => {
    const nums = selection.split(",").map(s=>parseInt(s.trim())).filter(Boolean);
    if (nums.length === 0) return;
    setResult({loading:true});
    const serverProb = await calcFromServer(nums);
    const simProb = await runSimulation(nums);
    const comb = combinatorial(nums.length);
    setResult({serverProb, simProb, comb});
  };

  return (
    <div className="py-6">
      <h2 className="text-2xl font-semibold mb-3">Calcul de probabilité</h2>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
          <label className="block text-sm font-medium">Sélectionnez vos numéros (ex: 1,5,12,16,23,34,45)</label>
          <input value={selection} onChange={e=>setSelection(e.target.value)} className="mt-2 w-full px-3 py-2 border rounded" />
          <div className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isPremium} onChange={e=>setIsPremium(e.target.checked)} />
              Calculer en utilisant l'historique complet (Premium)
            </label>
            <button onClick={onCalculate} className="ml-auto px-3 py-2 bg-blue-600 text-white rounded">Calculer</button>
          </div>

          {result && result.loading && <p className="mt-3">Calcul en cours…</p>}
          {result && !result.loading && (
            <div className="mt-3 text-sm text-gray-700 dark:text-gray-200 space-y-2">
              <div>Probabilité historique (server): {(result.serverProb*100).toFixed(6)}% </div>
              <div>Probabilité simulation MonteCarlo: {(result.simProb*100).toFixed(6)}%</div>
              {result.comb !== null && <div>Probabilité combinatoire (si 6 num sélectionnés): {(result.comb*100).toFixed(12)}%</div>}
            </div>
          )}
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
          <h4 className="font-medium">Simulation</h4>
          <label className="text-sm">Nombre de simulations</label>
          <input type="number" value={simCount} onChange={e=>setSimCount(e.target.value)} className="mt-2 px-3 py-2 border rounded w-full" />
          <p className="text-xs text-gray-500 mt-2">La simulation est simple (tirages aléatoires uniformes). Pour un calcul plus précis, on peut pondérer par fréquences historiques.</p>
        </div>
      </div>
    </div>
  );
}
