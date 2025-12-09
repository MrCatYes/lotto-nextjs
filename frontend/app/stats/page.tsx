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

// --------------------------- Types ---------------------------
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
  num7: number;
  bonus?: number;
  premium?: boolean;
};


// --------------------------- Composant principal ---------------------------
export default function StatsPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;

  const [isPremium, setIsPremium] = useState(false);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [tirages, setTirages] = useState<Tirage[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterPreset, setFilterPreset] = useState<"all" | "1m" | "6m" | "1y" | "custom">("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [sortKey, setSortKey] = useState<"number" | "count" | "lastSeen">("count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [fullscreenChart, setFullscreenChart] = useState<"bar" | "heat" | null>(null);

  const strategies = [
    "raw",
    "weighted",
    "zscore",
    "markov",
    "burst",
    "ai",
  ];
  
  const [selectedStrategy, setSelectedStrategy] = useState(strategies[0]);

  const [numberFilter, setNumberFilter] = useState<number | null>(null);


  const sortOptions = [
    { value: "count", label: "Nombre" },
    { value: "number", label: "Numéro" },
    { value: "lastSeen", label: "Dernière sortie" },
  ];
  const perPageOptions = [10, 25, 50, 100];


  const client = useMemo(() =>
    new ApolloClient({
      link: new HttpLink({
        uri: "http://localhost:4000/graphql",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      }),
      cache: new InMemoryCache(),
    }), [token]
  );

  // -------------------- Récupération des données --------------------
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const resOcc = await client.query({
          query: gql`
            query Occ($premium: Boolean) {
              occurrences(premium: $premium) {
                number
                count
              }
            }
          `,
          variables: { premium: !!isPremium },
          fetchPolicy: "no-cache",
        });
        setOccurrences(resOcc.data.occurrences || []);

        const resT = await client.query({
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
                num7
                bonus
                premium
              }
            }
          `,
          variables: { limit: 2000, premium: !!isPremium },
          fetchPolicy: "no-cache",
        });

        const ts: Tirage[] = resT.data.tirages || [];
        ts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTirages(ts);
      } catch (err) {
        console.error("Erreur GraphQL", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [client, isPremium]);

  // -------------------- Calculs --------------------
  const numbersMeta = useMemo(() => {
    const meta: {
      number: number;
      count: number;
      firstSeen?: string | null;
      lastSeen?: string | null;
      gapDays?: number | null;
      probability?: number;
    }[] = [];

    const occMap = new Map<number, number>();
    occurrences.forEach(o => occMap.set(o.number, o.count));

    const lastSeenMap = new Map<number, string>();
    const firstSeenMap = new Map<number, string>();

    for (const t of tirages) {
      const nums = [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6, t.num7, t.bonus];
      nums.forEach(n => {
        if (!n) return;
        if (!lastSeenMap.has(n)) lastSeenMap.set(n, t.date);
        if (!firstSeenMap.has(n) || new Date(t.date) < new Date(firstSeenMap.get(n)!)) firstSeenMap.set(n, t.date);
      });
    }

    const totalDraws = tirages.length || 1;
    for (let n = 1; n <= 50; n++) {
      const last = lastSeenMap.get(n) || null;
      const gap = last ? differenceInDays(new Date(), new Date(last)) : null;
      const cnt = occMap.get(n) || 0;
      const prob = totalDraws > 0 ? cnt / (totalDraws * 6) : 0;
      meta.push({
        number: n,
        count: cnt,
        lastSeen: last,
        firstSeen: firstSeenMap.get(n) || null,
        gapDays: gap,
        probability: prob,
      });
    }

    return meta;
  }, [occurrences, tirages]);

  // -------------------- Filtrage dynamique --------------------
  const filteredTirages = useMemo(() => {
    let from: Date | null = null;
    let to: Date | null = null;
    const now = new Date();
  
    if (filterPreset === "1m") from = subMonths(now, 1);
    else if (filterPreset === "6m") from = subMonths(now, 6);
    else if (filterPreset === "1y") from = subYears(now, 1);
    else if (filterPreset === "custom") {
      if (customFrom) {
        const d = parseISO(customFrom);
        if (!isNaN(d.getTime())) from = d;
      }
      if (customTo) {
        const d = parseISO(customTo);
        if (!isNaN(d.getTime())) to = d;
      }
    }
  
    return tirages.filter(t => {
      const d = new Date(t.date + "T00:00:00Z");
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (numberFilter && ![t.num1,t.num2,t.num3,t.num4,t.num5,t.num6, t.num7].includes(numberFilter)) return false;
      return true;
    });
  }, [tirages, filterPreset, customFrom, customTo, numberFilter]);
  
  const dynamicOccurrences = useMemo(() => {
    const map = new Map<number, number>();
    const tiragesToCount = filterPreset === "all" ? tirages : filteredTirages;
  
    for (const t of tiragesToCount) {
      [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6, t.num7].forEach(n => {
        map.set(n, (map.get(n) || 0) + 1);
      });
    }
  
    const arr: Occurrence[] = [];
    for (let i = 1; i <= 50; i++) {
      arr.push({ number: i, count: map.get(i) || 0 });
    }
  
    return arr.sort((a,b) => a.number - b.number);
  }, [tirages, filteredTirages, filterPreset]);
  
  
const [selectedMethod, setSelectedMethod] = useState<"ai" | "raw" | "weighted" | "markov" | "burst" | "zscore">("ai");


// simulateAll.tsx ou page.tsx

// State pour stocker les tirages simulés
const [simulatedDraws, setSimulatedDraws] = useState<{
  equilibre?: number[];
  agressif?: number[];
  conservateur?: number[];
}>({});

// Fonction pour appeler la mutation GraphQL et récupérer les 3 tirages
const simulateAll = async (backendMethod: "ai" | "raw" | "weighted" | "markov" | "burst" | "zscore" = "ai") => {
  try {
    const res = await client.mutate({
      mutation: gql`
        mutation SimulateDraw($mode: String!, $premium: Boolean!) {
          simulateDraw(mode: $mode, premium: $premium) {
            equilibre
            agressif
            conservateur
          }
        }
      `,
      variables: { mode: backendMethod, premium: isPremium ?? false }, // ✅ fallback
      fetchPolicy: "no-cache",
    });
    console.log("methode :", backendMethod);

    setSimulatedDraws(res.data?.simulateDraw ?? {});
    console.log("Tous les tirages simulés :", res.data?.simulateDraw);
  } catch (err) {
    console.error("Erreur simulation :", err);
    setSimulatedDraws({});
  }
};



  // -------------------- Top5 + delta --------------------
  const top5 = useMemo(() => {
    const curr = dynamicOccurrences.slice().sort((a, b) => b.count - a.count).slice(0, 5);
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
      const nums = [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6, t.num7].sort((a, b) => a - b);
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
                    className={`text-sm px-3 py-1 rounded-full border ${
                      numberFilter === item.number ? "bg-yellow-400 border-yellow-400 text-black" : "bg-transparent"
                    }`}
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

  // -------------------- Rendu --------------------
  return (
    <div className="py-6 max-w-7xl mx-auto px-4">
            {/* Heatmap clickable */}
            <div className="grid grid-cols-10 gap-1 mb-4">
        {dynamicOccurrences.map(d => (
          <div key={d.number} className="flex flex-col items-center">
            <div
              title={`${d.number}: ${d.count}`}
              onClick={() => setNumberFilter(numberFilter === d.number ? null : d.number)}
              className={`w-10 h-10 flex items-center justify-center rounded-full text-white font-semibold shadow cursor-pointer border-2 ${numberFilter === d.number ? "border-yellow-400" : "border-transparent"}`}
              style={{ background: heatColor(d.count) }}
            >
              {d.number}
            </div>
          </div>
        ))}
      </div>


<Listbox value={selectedMethod} onChange={setSelectedMethod}>
  <div className="relative w-48">
    <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-gray-100 dark:bg-gray-700 py-2 pl-3 pr-10 text-left shadow-md focus:outline-none">
      <span className="block truncate">{selectedMethod}</span>
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <ChevronUpDownIcon className="w-5 h-5 text-gray-400" />
      </span>
    </Listbox.Button>

    <Listbox.Options className="absolute mt-1 w-full bg-white dark:bg-gray-800 shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none">
      {["ai", "raw", "weighted", "markov", "burst", "zscore"].map((method) => (
        <Listbox.Option
          key={method}
          value={method}
          className={({ active }) =>
            `cursor-pointer select-none relative py-2 pl-10 pr-4 ${active ? "bg-blue-100 dark:bg-gray-700" : ""}`
          }
        >
          {({ selected }) => (
            <span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
              {method}
            </span>
          )}
        </Listbox.Option>
      ))}
    </Listbox.Options>
  </div>
</Listbox>

<button
  onClick={() => simulateAll(selectedMethod)}
  className="px-3 py-1 bg-yellow-500 text-black rounded my-4"
>
  Simuler tirages ({selectedMethod})
</button>

<div className="flex gap-3 mb-6">
  {["equilibre", "agressif", "conservateur"].map((mode) => (
    <div key={mode} className="p-3 bg-white dark:bg-gray-800 rounded shadow">
      <div className="text-sm text-gray-400">{mode.charAt(0).toUpperCase() + mode.slice(1)}</div>
      <div className="flex gap-1 mt-1">
        {((simulatedDraws as any)[mode] ?? []).map((n: number) => (
          <div
            key={n}
            className={`w-7 h-7 flex items-center justify-center text-white rounded-full text-sm ${
              mode === "equilibre" ? "bg-blue-600" : mode === "agressif" ? "bg-red-600" : "bg-green-600"
            }`}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  ))}
</div>



      {/* -------------------- Rendu UI (FR) -------------------- */}

      <div className="py-6 max-w-7xl mx-auto px-4">
        {/* Entête */}
        
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Statistiques Lotto</h2>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
              Simuler Premium
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => setFullscreenChart("bar")} className="px-3 py-1 bg-gray-800 rounded border">Afficher histogramme</button>
              <button onClick={() => setFullscreenChart("heat")} className="px-3 py-1 bg-gray-800 rounded border">Afficher heatmap</button>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button className={`px-3 py-1 rounded ${filterPreset === "all" ? "bg-gray-900 text-white" : "bg-gray-800"}`} onClick={() => setFilterPreset("all")}>Tous</button>
            <button className={`px-3 py-1 rounded ${filterPreset === "1m" ? "bg-gray-900 text-white" : "bg-gray-800"}`} onClick={() => setFilterPreset("1m")}>1 mois</button>
            <button className={`px-3 py-1 rounded ${filterPreset === "6m" ? "bg-gray-900 text-white" : "bg-gray-800"}`} onClick={() => setFilterPreset("6m")}>6 mois</button>
            <button className={`px-3 py-1 rounded ${filterPreset === "1y" ? "bg-gray-900 text-white" : "bg-gray-800"}`} onClick={() => setFilterPreset("1y")}>1 an</button>
            <button className={`px-3 py-1 rounded ${filterPreset === "custom" ? "bg-gray-900 text-white" : "bg-gray-800"}`} onClick={() => setFilterPreset("custom")}>Période</button>
          </div>

          {filterPreset === "custom" && (
            <div className="flex gap-2 items-center">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="border rounded px-2 py-1" />
              <span className="text-sm">→</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="border rounded px-2 py-1" />
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            <label className="text-sm">Résultats / page  </label>
            <Listbox value={perPage} onChange={(val) => setPerPage(val)}>
              <div className="relative w-24 ml-2">
                <Listbox.Button className="relative w-full cursor-pointer rounded border border-gray-300 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-400 flex justify-between items-center">
                  {perPage}
                  <ChevronUpDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-300" />
                </Listbox.Button>

                <Listbox.Options className="absolute z-10 mt-1 w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg max-h-60 overflow-auto">
                  {perPageOptions.map((n) => (
                    <Listbox.Option key={n} value={n} as={Fragment}>
                      {({ active, selected }) => (
                        <li
                          className={`cursor-pointer px-3 py-2 ${
                            active ? "bg-gray-600 text-white" : "text-gray-900 dark:text-gray-100"
                          } ${selected ? "font-bold" : ""}`}
                        >
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

        {/* Cartes hautes */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
            <div className="text-sm text-gray-500">Tirages chargés</div>
            <div className="text-2xl font-bold">{tirages.length}</div>
          </div>

          <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
            <div className="text-sm text-gray-500">Top 1 (période)</div>
            <div className="text-2xl font-bold">
              {dynamicOccurrences.slice().sort((a, b) => b.count - a.count)[0]?.number || "-"} ({dynamicOccurrences.slice().sort((a, b) => b.count - a.count)[0]?.count || 0})
            </div>
          </div>
        </div>

        {/* Ligne de graphiques */}
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          {/* Histogramme */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded shadow h-72">
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

          {/* Heatmap */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
            <div className="text-sm font-semibold mb-2">Heatmap (1–50)</div>
            <div className="grid grid-cols-10 gap-1">
              {dynamicOccurrences.map(d => (
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

        {/* Top5 amélioré - intégré */}
        <Top5Period data={top5} />

        {/* Top Paires */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-lg font-semibold">Paires les plus fréquentes</div>
            <div className="text-sm text-gray-500">Top {topPairs.length}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {topPairs.map((p, idx) => (
              <div key={idx} className="p-2 bg-white dark:bg-gray-800 rounded shadow flex items-center justify-between">
                <div className="font-semibold">{p.pair}</div>
                <div className="text-sm text-gray-600">{p.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tableau détaillé */}
        <div className="bg-white dark:bg-gray-800 rounded shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold">Table des numéros</div>
            <div className="flex items-center gap-2">
              <label className="text-sm">Trier par</label>
              <Listbox value={sortKey} onChange={(val) => setSortKey(val)}>
                <div className="relative w-40">
                  <Listbox.Button className="relative w-full cursor-pointer rounded border border-gray-300 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-400 flex justify-between items-center">
                    {sortOptions.find((o) => o.value === sortKey)?.label ?? "Trier par"}
                    <ChevronUpDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-300" />
                  </Listbox.Button>

                  <Listbox.Options className="absolute z-10 mt-1 w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg max-h-60 overflow-auto">
                    {sortOptions.map((opt) => (
                      <Listbox.Option key={opt.value} value={opt.value} as={Fragment}>
                        {({ active, selected }) => (
                          <li
                            className={`cursor-pointer px-3 py-2 ${
                              active ? "bg-gray-600 text-white" : "text-gray-900 dark:text-gray-100"
                            } ${selected ? "font-bold" : ""}`}
                          >
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
            <table className="min-w-full text-left">
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

          {/* pagination */}
          <div className="flex items-center justify-between mt-3">
            <div>
              Page {page} / {pageCount}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 border rounded">Préc</button>
              <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="px-3 py-1 border rounded">Suiv</button>
            </div>
          </div>
        </div>

        {/* Fullscreen overlay */}
        {fullscreenChart && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded shadow w-full max-w-6xl h-full max-h-[90vh] p-4 overflow-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xl font-semibold">{fullscreenChart === "bar" ? "Histogramme (plein écran)" : "Heatmap (plein écran)"}</div>
                <button onClick={() => setFullscreenChart(null)} className="px-3 py-1 bg-gray-800 rounded border">Fermer</button>
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
                  {dynamicOccurrences.map(d => (
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
    </div>
  );
}
