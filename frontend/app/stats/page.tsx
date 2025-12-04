"use client";

import React, { useEffect, useMemo, useState, Fragment } from "react";
import { ApolloClient, InMemoryCache, HttpLink, gql } from "@apollo/client";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format, subMonths, subYears, parseISO, differenceInDays } from "date-fns";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

/* ============================================================
   TYPES
   ============================================================ */

type Occurrence = { number: number; count: number };

type Tirage = {
  id?: string;
  date: string;
  num1: number;
  num2: number;
  num3: number;
  num4: number;
  num5: number;
  num6: number;
  bonus?: number;
  premium?: boolean;
};

type RecoCombo = { name: string; numbers: number[] };

/* ============================================================
   PAGE
   ============================================================ */

export default function StatsPage() {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("adminToken")
      : null;

  /* -------------------- STATES -------------------- */
  const [isPremium, setIsPremium] = useState(false);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [tirages, setTirages] = useState<Tirage[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterPreset, setFilterPreset] = useState<
    "all" | "1m" | "6m" | "1y" | "custom"
  >("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [numberFilter, setNumberFilter] = useState<number | null>(null);

  const [recoMethod, setRecoMethod] = useState<
    "raw" | "weighted" | "zscore" | "markov" | "burst" | "ai"
  >("raw");

  const [fullscreenChart, setFullscreenChart] = useState<"bar" | "heat" | null>(null);

  // Explications des méthodes de recommandations
  const recoExplanations: Record<string, string> = {
    raw: "Méthode brute (simple sélection selon occurrences totales).",
    weighted: "Méthode pondérée (favorise les numéros récents avec un poids décroissant).",
    zscore: "Méthode Z-Score (détecte les anomalies statistiques : sur/sous-fréquence).",
    markov: "Méthode Markov (probabilités basées sur les co-occurrences précédentes).",
    burst: "Méthode Burst (repère les numéros en explosion dans les dernières semaines).",
    ai: "Méthode IA fusionnée (combine fréquence globale, pondérée et momentum).",
  };
  

  // ★★★ NOUVEAU : contient les 3 tirages simulés
  const [simulatedCombos, setSimulatedCombos] =
    useState<RecoCombo[] | null>(null);

  const client = useMemo(
    () =>
      new ApolloClient({
        link: new HttpLink({
          uri: "http://localhost:4000/graphql",
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        }),
        cache: new InMemoryCache(),
      }),
    [token]
  );

  /* ============================================================
      FETCH DES DONNÉES
     ============================================================ */

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const occ = await client.query({
          query: gql`
            query ($premium: Boolean) {
              occurrences(premium: $premium) {
                number
                count
              }
            }
          `,
          variables: { premium: isPremium },
          fetchPolicy: "no-cache",
        });

        setOccurrences(occ.data.occurrences || []);

        const res = await client.query({
          query: gql`
            query Tirages($limit: Int!, $premium: Boolean!) {
              tirages(limit: $limit, premium: $premium) {
                id
                date
                num1
                num2
                num3
                num4
                num5
                num6
                bonus
              }
            }
          `,
          variables: { limit: 2000, premium: isPremium },
          fetchPolicy: "no-cache",
        });

        const sorted = [...res.data.tirages].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setTirages(sorted);
      } catch (err) {
        console.error("GraphQL ERROR:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [client, isPremium]);

  /* ============================================================
      CALCUL DES MÉTADONNÉES PAR NUMÉRO
     ============================================================ */

  const numbersMeta = useMemo(() => {
    const meta: {
      number: number;
      count: number;
      firstSeen?: string | null;
      lastSeen?: string | null;
      gapDays?: number | null;
      probability?: number;
    }[] = [];

    const map = new Map<number, number>();
    occurrences.forEach((o) => map.set(o.number, o.count));

    const lastSeen = new Map<number, string>();
    const firstSeen = new Map<number, string>();

    for (const t of tirages) {
      const nums = [
        t.num1,
        t.num2,
        t.num3,
        t.num4,
        t.num5,
        t.num6,
        t.bonus,
      ];

      nums.forEach((n) => {
        if (!n) return;
        if (!lastSeen.has(n)) lastSeen.set(n, t.date);
        if (
          !firstSeen.has(n) ||
          new Date(t.date) < new Date(firstSeen.get(n)!)
        ) {
          firstSeen.set(n, t.date);
        }
      });
    }

    const total = tirages.length || 1;

    for (let n = 1; n <= 50; n++) {
      const cnt = map.get(n) || 0;
      const last = lastSeen.get(n) || null;

      meta.push({
        number: n,
        count: cnt,
        lastSeen: last,
        firstSeen: firstSeen.get(n) || null,
        gapDays: last ? differenceInDays(new Date(), new Date(last)) : null,
        probability: cnt / (total * 6),
      });
    }

    return meta;
  }, [occurrences, tirages]);

  /* ============================================================
      FILTRES
     ============================================================ */

  const filteredTirages = useMemo(() => {
    let from: Date | null = null;
    let to: Date | null = null;
    const now = new Date();

    if (filterPreset === "1m") from = subMonths(now, 1);
    else if (filterPreset === "6m") from = subMonths(now, 6);
    else if (filterPreset === "1y") from = subYears(now, 1);
    else if (filterPreset === "custom") {
      if (customFrom) from = parseISO(customFrom);
      if (customTo) to = parseISO(customTo);
    }

    return tirages.filter((t) => {
      const d = new Date(t.date + "T00:00:00Z");
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (
        numberFilter &&
        ![
          t.num1,
          t.num2,
          t.num3,
          t.num4,
          t.num5,
          t.num6,
        ].includes(numberFilter)
      )
        return false;

      return true;
    });
  }, [tirages, filterPreset, customFrom, customTo, numberFilter]);

  /* ============================================================
      OCCURRENCES FILTRÉES
     ============================================================ */

  const dynamicOccurrences = useMemo(() => {
    const map = new Map<number, number>();
    const source =
      filterPreset === "all" ? tirages : filteredTirages;

    for (const t of source) {
      [
        t.num1,
        t.num2,
        t.num3,
        t.num4,
        t.num5,
        t.num6,
      ].forEach((n) => {
        map.set(n, (map.get(n) || 0) + 1);
      });
    }

    const arr: Occurrence[] = [];
    for (let i = 1; i <= 50; i++) {
      arr.push({ number: i, count: map.get(i) || 0 });
    }
    return arr;
  }, [tirages, filteredTirages, filterPreset]);
  // -------------------- Recommandations --------------------
  const recommandations: RecoCombo[] = useMemo(() => {
    let scored = numbersMeta.slice();

    if (recoMethod === "weighted") {
      const weights = new Map<number, number>();
      tirages.forEach((t, idx) => {
        const w = 1 + ((tirages.length - idx) / tirages.length) * 5;
        [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6].forEach((n) => {
          weights.set(n, (weights.get(n) || 0) + w);
        });
      });
      scored.forEach((n) => (n.probability = weights.get(n.number) || 0));
    } else if (recoMethod === "zscore") {
      const probs = scored.map((n) => n.probability || 0);
      const avg = probs.reduce((a, b) => a + b, 0) / probs.length;
      const std = Math.sqrt(
        probs.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / probs.length
      );
      scored.forEach(
        (n) => (n.probability = std === 0 ? 0 : (n.probability || 0 - avg) / std)
      );
    } else if (recoMethod === "markov") {
      const matrix = new Map<number, Map<number, number>>();
      tirages.forEach((t) => {
        const nums = [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6];
        nums.forEach((a) => {
          if (!matrix.has(a)) matrix.set(a, new Map());
          nums.forEach((b) => {
            if (a !== b)
              matrix.get(a)!.set(b, (matrix.get(a)!.get(b) || 0) + 1);
          });
        });
      });
      scored.forEach((n) => {
        const row = matrix.get(n.number);
        n.probability = row
          ? Array.from(row.values()).reduce((a, b) => a + b, 0)
          : 0;
      });
    } else if (recoMethod === "burst") {
      const recent = tirages.slice(-30);
      const mid = tirages.slice(-100);
      const recentCount = new Map<number, number>();
      const midCount = new Map<number, number>();
      recent.forEach((t) =>
        [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6].forEach((n) =>
          recentCount.set(n, (recentCount.get(n) || 0) + 1)
        )
      );
      mid.forEach((t) =>
        [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6].forEach((n) =>
          midCount.set(n, (midCount.get(n) || 0) + 1)
        )
      );
      scored.forEach((n) => {
        const r = recentCount.get(n.number) || 0;
        const m = midCount.get(n.number) || 1;
        n.probability = r / m;
      });
    } else if (recoMethod === "ai") {
      const freqMap = new Map(numbersMeta.map((n) => [n.number, n.count]));
      const weightedMap = new Map<number, number>();
      tirages.forEach((t, idx) => {
        const w = 1 + ((tirages.length - idx) / tirages.length) * 5;
        [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6].forEach((n) =>
          weightedMap.set(n, (weightedMap.get(n) || 0) + w)
        );
      });

      const sliceA = tirages.slice(-100),
        sliceB = tirages.slice(-50);
      const countA = new Map<number, number>(),
        countB = new Map<number, number>();
      sliceA.forEach((t) =>
        [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6].forEach((n) =>
          countA.set(n, (countA.get(n) || 0) + 1)
        )
      );
      sliceB.forEach((t) =>
        [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6].forEach((n) =>
          countB.set(n, (countB.get(n) || 0) + 1)
        )
      );

      const momentum = new Map<number, number>();
      scored.forEach((n) =>
        momentum.set(
          n.number,
          ((countB.get(n.number) || 0) - (countA.get(n.number) || 1) / 2) /
            (countA.get(n.number) || 1)
        )
      );

      scored.forEach((n) => {
        const f = freqMap.get(n.number) || 0;
        const w = weightedMap.get(n.number) || 0;
        const m = momentum.get(n.number) || 0;
        n.probability = f * 0.4 + w * 0.4 + m * 0.2;
      });
    }

    scored.sort((a, b) => (b.probability || 0) - (a.probability || 0));
    return [
      { name: "Équilibré", numbers: scored.slice(0, 6).map((n) => n.number) },
      {
        name: "Agressif",
        numbers: scored
          .slice(0, 3)
          .map((n) => n.number)
          .concat(scored.slice(-3).map((n) => n.number)),
      },
      { name: "Conservateur", numbers: scored.slice(-6).map((n) => n.number) },
    ];
  }, [numbersMeta, tirages, recoMethod]);

  // -------------------- Top5 + delta --------------------
  const top5 = useMemo(() => {
    const curr = dynamicOccurrences
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const globalMap = new Map<number, number>();
    occurrences.forEach((o) => globalMap.set(o.number, o.count));
    return curr.map((c) => {
      const global = globalMap.get(c.number) || 0;
      const delta = global === 0 ? null : ((c.count - global) / (global || 1)) * 100;
      return { ...c, delta };
    });
  }, [dynamicOccurrences, occurrences]);

  // -------------------- Top Paires --------------------
  const topPairs = useMemo(() => {
    const pairMap = new Map<string, number>();
    for (const t of filteredTirages) {
      const nums = [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6].sort(
        (a, b) => a - b
      );
      for (let i = 0; i < nums.length; i++)
        for (let j = i + 1; j < nums.length; j++) {
          const key = `${nums[i]}|${nums[j]}`;
          pairMap.set(key, (pairMap.get(key) || 0) + 1);
        }
    }
    const arr = Array.from(pairMap.entries()).map(([k, v]) => {
      const [a, b] = k.split("|").map(Number);
      return { pair: `${a}-${b}`, a, b, count: v };
    });
    arr.sort((x, y) => y.count - x.count);
    return arr.slice(0, 20);
  }, [filteredTirages]);

  // -------------------- Heat color util --------------------
  const heatColor = (count: number) => {
    const max = Math.max(...dynamicOccurrences.map((d) => d.count), 1);
    const t = count / max;
    const blue = [13, 110, 253];
    const green = [25, 135, 84];
    const r = Math.round(green[0] * (1 - t) + blue[0] * t);
    const g = Math.round(green[1] * (1 - t) + blue[1] * t);
    const b = Math.round(green[2] * (1 - t) + blue[2] * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // -------------------- Tableau & pagination --------------------
  const [sortKey, setSortKey] = useState<"number" | "count" | "lastSeen">("count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const perPageOptions = [10, 25, 50, 100];
  const sortOptions = [
    { value: "count", label: "Nombre" },
    { value: "number", label: "Numéro" },
    { value: "lastSeen", label: "Dernière sortie" },
  ];

  const tableData = useMemo(() => {
    let rows = numbersMeta.map((m) => ({
      number: m.number,
      count: m.count,
      lastSeen: m.lastSeen,
      firstSeen: m.firstSeen,
      gapDays: m.gapDays,
      probability: m.probability,
    }));
    rows.sort((a, b) => {
      let v = 0;
      if (sortKey === "count") v = a.count - b.count;
      if (sortKey === "number") v = a.number - b.number;
      if (sortKey === "lastSeen") {
        const ta = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
        const tb = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
        v = ta - tb;
      }
      return sortDir === "asc" ? v : -v;
    });
    return rows;
  }, [numbersMeta, sortKey, sortDir]);

  const pageCount = Math.ceil(tableData.length / perPage);
  const pageRows = tableData.slice((page - 1) * perPage, page * perPage);

  // -------------------- Export XLSX --------------------
  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["Numéro", "Occurrences", "Dernière sortie", "Première sortie", "Écart (jours)", "Probabilité (par tirage)"],
      ...tableData.map((r) => [
        r.number,
        r.count,
        r.lastSeen ?? "-",
        r.firstSeen ?? "-",
        r.gapDays ?? "-",
        r.probability !== undefined ? r.probability.toFixed(5) : "-",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Numbers");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout]), `stats_numbers_${Date.now()}.xlsx`);
  };

  // -------------------- Top5 UI intégré --------------------
  const Top5Period: React.FC<{ data: { number: number; count: number; delta: number | null }[] }> = ({ data }) => {
    if (!data || data.length === 0) return <div className="text-sm text-gray-500">Aucun résultat pour cette période.</div>;
    return (
      <div className="mb-6">
        <div className="text-lg font-semibold mb-2">Top 5 (période)</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {data.map((item, i) => {
            const isPositive = item.delta !== null && item.delta > 0;
            const isNegative = item.delta !== null && item.delta < 0;
            return (
              <motion.div
                key={item.number}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl shadow-md bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">#{item.number}</div>
                  {item.delta === null ? (
                    <div className="flex items-center text-gray-400">
                      <Minus size={18} />
                      <span className="ml-1 text-sm">-</span>
                    </div>
                  ) : isPositive ? (
                    <div className="flex items-center text-green-600 dark:text-green-400">
                      <ArrowUp size={18} />
                      <span className="ml-2 text-sm font-semibold">{item.delta.toFixed(1)}%</span>
                    </div>
                  ) : isNegative ? (
                    <div className="flex items-center text-red-600 dark:text-red-400">
                      <ArrowDown size={18} />
                      <span className="ml-2 text-sm font-semibold">{item.delta.toFixed(1)}%</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-gray-400">
                      <Minus size={18} />
                      <span className="ml-1 text-sm">0%</span>
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-300">Sorties dans la période :</div>
                <div className="mt-1 text-2xl font-bold">{item.count}</div>
                <div className="mt-3">
                  <button
                    onClick={() => setNumberFilter(numberFilter === item.number ? null : item.number)}
                    className={`text-sm px-3 py-1 rounded-full border ${numberFilter === item.number ? "bg-yellow-400 border-yellow-400 text-black" : "bg-transparent"}`}
                    aria-pressed={numberFilter === item.number}
                    title={numberFilter === item.number ? "Retirer le filtre" : "Filtrer par ce numéro"}
                  >
                    {numberFilter === item.number ? "Filtré" : "Filtrer"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  // -------------------- Simulation : générer 3 combinaisons selon méthode --------------------
  const handleSimulate = () => {
    // On se base sur recommandations calculées plus haut (qui tiennent compte de recoMethod)
    setSimulatedCombos(recommandations);
  };

  // -------------------- UI : bouton + blocs Équilibré/Agressif/Conservateur --------------------
  // (le rendu complet est dans la PARTIE 3)
  // -------------------- Rendu (PARTIE 3/3) --------------------
  return (
    <div className="py-6 max-w-7xl mx-auto px-4">
      {/* Heatmap clickable */}
      <div className="grid grid-cols-10 gap-1 mb-4">
        {dynamicOccurrences.map((d) => (
          <div key={d.number} className="flex flex-col items-center">
            <div
              title={`${d.number}: ${d.count}`}
              onClick={() =>
                setNumberFilter(numberFilter === d.number ? null : d.number)
              }
              className={`w-10 h-10 flex items-center justify-center rounded-full text-white font-semibold shadow cursor-pointer border-2 ${
                numberFilter === d.number ? "border-yellow-400" : "border-transparent"
              }`}
              style={{ background: heatColor(d.count) }}
            >
              {d.number}
            </div>
          </div>
        ))}
      </div>

      {/* Sélecteur méthode */}
      <div className="mb-4 flex items-center gap-3">
        <label className="font-semibold">Méthode de calcul :</label>
        <Listbox value={recoMethod} onChange={setRecoMethod}>
          <div className="relative w-52">
            <Listbox.Button className="relative w-full cursor-pointer bg-gray-800 rounded border px-3 py-2 text-left flex justify-between items-center">
              {recoExplanations[recoMethod].slice(0, 40)}...
              <ChevronUpDownIcon className="h-5 w-5" />
            </Listbox.Button>
            <Listbox.Options className="absolute z-10 mt-1 w-full bg-gray-800 border rounded shadow max-h-60 overflow-auto">
              {Object.keys(recoExplanations).map((key) => (
                <Listbox.Option key={key} value={key} as={Fragment}>
                  {({ active, selected }) => (
                    <li className={`cursor-pointer px-3 py-2 ${active ? "bg-gray-600 text-white" : ""} ${selected ? "font-bold" : ""}`}>
                      {key} - {recoExplanations[key]}
                    </li>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        </Listbox>
      </div>

      <div className="mb-4 text-sm text-gray-600">{recoExplanations[recoMethod]}</div>

      {/* Bouton simulation tirages */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={handleSimulate}
          className="px-3 py-1 bg-yellow-500 text-black rounded"
          title="Générer 3 tirages simulés selon la méthode sélectionnée"
        >
          Simuler tirages
        </button>

        <button
          onClick={() => setSimulatedCombos(null)}
          className="px-3 py-1 border rounded"
          title="Réinitialiser les tirages simulés"
        >
          Réinitialiser simulation
        </button>
      </div>

      {/* Blocs Équilibré / Agressif / Conservateur (utilise simulatedCombos si présent) */}
      <div className="flex gap-3 mb-6">
        {(simulatedCombos || recommandations).map((r) => (
          <div key={r.name} className="p-3 bg-white dark:bg-gray-800 rounded shadow cursor-pointer w-full">
            <div className="text-sm text-gray-500">{r.name}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {r.numbers.map((n) => (
                <div key={n} className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white">{n}</div>
              ))}
            </div>
            <div className="mt-3">
              <button
                onClick={() => setNumberFilter(numberFilter === r.numbers[0] ? null : r.numbers[0])}
                className="text-xs px-2 py-1 border rounded"
              >
                Filtrer par 1er numéro
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* En-tête, filtres & actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Statistiques Lotto</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
            Simuler Premium
          </label>
          <div className="flex items-center gap-2">
            <button onClick={() => setFullscreenChart("bar")} className="px-3 py-1 bg-gray-800 text-white rounded border">Afficher histogramme</button>
            <button onClick={() => setFullscreenChart("heat")} className="px-3 py-1 bg-gray-800 text-white rounded border">Afficher heatmap</button>
          </div>
        </div>
      </div>

      {/* Filtres (période, pagination, export) */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button className={`px-3 py-1 rounded ${filterPreset === "all" ? "bg-gray-900 text-white" : "bg-gray-800 text-white"}`} onClick={() => setFilterPreset("all")}>Tous</button>
          <button className={`px-3 py-1 rounded ${filterPreset === "1m" ? "bg-gray-900 text-white" : "bg-gray-800 text-white"}`} onClick={() => setFilterPreset("1m")}>1 mois</button>
          <button className={`px-3 py-1 rounded ${filterPreset === "6m" ? "bg-gray-900 text-white" : "bg-gray-800 text-white"}`} onClick={() => setFilterPreset("6m")}>6 mois</button>
          <button className={`px-3 py-1 rounded ${filterPreset === "1y" ? "bg-gray-900 text-white" : "bg-gray-800 text-white"}`} onClick={() => setFilterPreset("1y")}>1 an</button>
          <button className={`px-3 py-1 rounded ${filterPreset === "custom" ? "bg-gray-900 text-white" : "bg-gray-800 text-white"}`} onClick={() => setFilterPreset("custom")}>Période</button>
        </div>

        {filterPreset === "custom" && (
          <div className="flex gap-2 items-center">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="border rounded px-2 py-1" />
            <span className="text-sm">→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="border rounded px-2 py-1" />
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          <label className="text-sm">Résultats / page</label>
          <Listbox value={perPage} onChange={(val) => setPerPage(val)}>
            <div className="relative w-24 ml-2">
              <Listbox.Button className="relative w-full cursor-pointer rounded border border-gray-300 bg-gray-800 text-white px-3 py-2 text-left flex justify-between items-center">
                {perPage}
                <ChevronUpDownIcon className="h-5 w-5 text-gray-500" />
              </Listbox.Button>

              <Listbox.Options className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-300 rounded shadow-lg max-h-60 overflow-auto">
                {perPageOptions.map((n) => (
                  <Listbox.Option key={n} value={n} as={Fragment}>
                    {({ active, selected }) => (
                      <li className={`cursor-pointer px-3 py-2 ${active ? "bg-gray-600 text-white" : "text-white"} ${selected ? "font-bold" : ""}`}>
                        {n}
                      </li>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>

          <button onClick={exportXLSX} className="px-3 py-1 bg-green-600 text-white rounded">Exporter XLSX</button>
        </div>
      </div>

      {/* Cartes rapides */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-gray-800 rounded shadow">
          <div className="text-sm text-gray-500">Tirages chargés</div>
          <div className="text-2xl font-bold">{tirages.length}</div>
        </div>

        <div className="p-4 bg-gray-800 rounded shadow">
          <div className="text-sm text-gray-500">Top 1 (période)</div>
          <div className="text-2xl font-bold">
            {dynamicOccurrences.slice().sort((a, b) => b.count - a.count)[0]?.number || "-"} ({dynamicOccurrences.slice().sort((a, b) => b.count - a.count)[0]?.count || 0})
          </div>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-gray-800 rounded shadow h-72">
          <div className="text-sm font-semibold mb-2">Fréquence des numéros</div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dynamicOccurrences}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="number" />
              <YAxis />
              <Tooltip formatter={(value: any) => [value, "Apparitions"]} />
              <Bar dataKey="count" fill="#0d6efd" isAnimationActive />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="p-4 bg-gray-800 rounded shadow">
          <div className="text-sm font-semibold mb-2">Heatmap (1–50)</div>
          <div className="grid grid-cols-10 gap-1">
            {dynamicOccurrences.map((d) => (
              <div key={d.number} className="flex flex-col items-center">
                <div
                  title={`${d.number}: ${d.count}`}
                  className="w-10 h-10 flex items-center justify-center rounded-full text-white font-semibold shadow"
                  style={{ background: heatColor(d.count) }}
                >
                  {d.number}
                </div>
                <div className="text-xs text-gray-500">{d.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top5 */}
      <Top5Period data={top5} />

      {/* Top Paires */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-lg font-semibold">Paires les plus fréquentes</div>
          <div className="text-sm text-gray-500">Top {topPairs.length}</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {topPairs.map((p, idx) => (
            <div key={idx} className="p-2 bg-gray-800 rounded shadow flex items-center justify-between">
              <div className="font-semibold">{p.pair}</div>
              <div className="text-sm text-gray-600">{p.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-gray-800 rounded shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Table des numéros</div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Trier par</label>
            <Listbox value={sortKey} onChange={(val) => setSortKey(val)}>
              <div className="relative w-40">
                <Listbox.Button className="relative w-full cursor-pointer rounded border border-gray-300 bg-gray-800 text-white px-3 py-2 text-left flex justify-between items-center">
                  {sortOptions.find((o) => o.value === sortKey)?.label ?? "Trier par"}
                  <ChevronUpDownIcon className="h-5 w-5 text-gray-500" />
                </Listbox.Button>

                <Listbox.Options className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-300 rounded shadow-lg max-h-60 overflow-auto">
                  {sortOptions.map((opt) => (
                    <Listbox.Option key={opt.value} value={opt.value} as={Fragment}>
                      {({ active, selected }) => (
                        <li className={`cursor-pointer px-3 py-2 ${active ? "bg-gray-600 text-white" : "text-white"} ${selected ? "font-bold" : ""}`}>
                          {opt.label}
                        </li>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Listbox>

            <button onClick={() => setSortDir((s) => (s === "asc" ? "desc" : "asc"))} className="px-2 py-1 border rounded">{sortDir === "asc" ? "↑" : "↓"}</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className=" min-w-full text-left">
            <thead>
              <tr className="bg-gray-700">
                <th className="px-3 py-2">Numéro</th>
                <th className="px-3 py-2">Occurrences</th>
                <th className="px-3 py-2">Dernière sortie</th>
                <th className="px-3 py-2">Première sortie</th>
                <th className="px-3 py-2">Écart (jours)</th>
                <th className="px-3 py-2">Prob. (par tirage)</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.number} className="border-b">
                  <td className="px-3 py-2 font-semibold">{r.number}</td>
                  <td className="px-3 py-2">{r.count}</td>
                  <td className="px-3 py-2">{r.lastSeen ?? "-"}</td>
                  <td className="px-3 py-2">{r.firstSeen ?? "-"}</td>
                  <td className="px-3 py-2">{r.gapDays ?? "-"}</td>
                  <td className="px-3 py-2">{r.probability !== undefined ? (r.probability * 100).toFixed(3) + " %" : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-3">
          <div>Page {page} / {pageCount}</div>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 border rounded">Préc</button>
            <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="px-3 py-1 border rounded">Suiv</button>
          </div>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {fullscreenChart && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow w-full max-w-6xl h-full max-h-[90vh] p-4 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xl font-semibold">{fullscreenChart === "bar" ? "Histogramme (plein écran)" : "Heatmap (plein écran)"}</div>
              <button onClick={() => setFullscreenChart(null)} className="px-3 py-1 bg-gray-800 text-white rounded border">Fermer</button>
            </div>

            {fullscreenChart === "bar" && (
              <ResponsiveContainer width="100%" height={700}>
                <BarChart data={dynamicOccurrences}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="number" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0d6efd" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {fullscreenChart === "heat" && (
              <div className="grid grid-cols-10 gap-2">
                {dynamicOccurrences.map((d) => (
                  <div key={d.number} className="flex flex-col items-center">
                    <div className="w-16 h-16 flex items-center justify-center rounded-full text-white font-semibold" style={{ background: heatColor(d.count) }}>
                      {d.number}
                    </div>
                    <div className="mt-2">{d.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
