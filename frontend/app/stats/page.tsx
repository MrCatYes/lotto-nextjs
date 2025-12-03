"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ApolloClient, InMemoryCache, HttpLink, gql } from "@apollo/client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { format, subMonths, subYears, parseISO } from "date-fns";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

// --------------------------- Types ---------------------------
type Occurrence = { number: number; count: number };
type Tirage = {
  id?: string;
  date: string; // YYYY-MM-DD
  num1: number;
  num2: number;
  num3: number;
  num4: number;
  num5: number;
  num6: number;
  bonus?: number;
  premium?: boolean;
};

// --------------------------- Component ---------------------------
export default function StatsPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
  const [isPremium, setIsPremium] = useState(false);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [tirages, setTirages] = useState<Tirage[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterPreset, setFilterPreset] = useState<"all" | "1m" | "6m" | "1y" | "custom">("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [compareYearA, setCompareYearA] = useState<number | null>(null);
  const [compareYearB, setCompareYearB] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<"number" | "count" | "lastSeen">("count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [fullscreenChart, setFullscreenChart] = useState<"bar" | "heat" | null>(null);

  const client = useMemo(
    () =>
      new ApolloClient({
        link: new HttpLink({
          uri: "http://localhost:4000/graphql",
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        }),
        cache: new InMemoryCache(),
      }),
    [token]
  );

  // -------------------- Fetch data --------------------
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // 1) occurrences (count per number)
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

        const occ: Occurrence[] = resOcc.data.occurrences || [];
        setOccurrences(occ);

        // 2) pull recent tirages to compute last/first seen etc.
        // Note: adjust limit if you have many rows; we request 2000 here as "enough".
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
                bonus
                premium
              }
            }
          `,
          variables: { limit: 2000, premium: !!isPremium },
          fetchPolicy: "no-cache",
        });

        const ts: Tirage[] = resT.data.tirages || [];
        // ensure ordered most recent first
        ts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTirages(ts);
      } catch (err) {
        console.error("GraphQL error", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [client, isPremium]);

  // -------------------- Helpers --------------------
  // compute lastSeen and firstSeen for numbers 1..50
  const numbersMeta = useMemo(() => {
    // default meta
    const meta: {
      number: number;
      count: number;
      firstSeen?: string | null;
      lastSeen?: string | null;
      gaps?: number; // days since last seen approx.
    }[] = [];

    const occMap = new Map<number, number>();
    occurrences.forEach((o) => occMap.set(o.number, o.count));

    // traverse tirages once to find last/first seen
    const lastSeenMap = new Map<number, string>();
    const firstSeenMap = new Map<number, string>();

    for (const t of tirages) {
      const d = t.date;
      [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6, t.bonus].forEach((n) => {
        if (n === undefined || n === null) return;
        // lastSeen: first time we encounter in the sorted (most recent first) tirages is last seen
        if (!lastSeenMap.has(n)) lastSeenMap.set(n, d);
        // firstSeen: set if not present OR if this date is older
        if (!firstSeenMap.has(n)) firstSeenMap.set(n, d);
        else {
          const prev = firstSeenMap.get(n)!;
          if (new Date(d).getTime() < new Date(prev).getTime()) firstSeenMap.set(n, d);
        }
      });
    }

    for (let n = 1; n <= 50; n++) {
      meta.push({
        number: n,
        count: occMap.get(n) || 0,
        lastSeen: lastSeenMap.get(n) || null,
        firstSeen: firstSeenMap.get(n) || null,
      });
    }

    return meta;
  }, [occurrences, tirages]);

  // filter by date range
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
      const d = new Date(t.date + "T00:00:00Z"); // parse safely as UTC
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [tirages, filterPreset, customFrom, customTo]);

  // filtered occurrences (recompute counts from filteredTirages for dynamic filters)
  const dynamicOccurrences = useMemo(() => {
    const map = new Map<number, number>();
    for (const t of filteredTirages) {
      [t.num1, t.num2, t.num3, t.num4, t.num5, t.num6].forEach((n) => {
        map.set(n, (map.get(n) || 0) + 1);
      });
    }
    const arr: Occurrence[] = Array.from(map.entries()).map(([number, count]) => ({ number, count }));
    // ensure 1..50 present (maybe zero)
    for (let i = 1; i <= 50; i++) {
      if (!map.has(i)) arr.push({ number: i, count: 0 });
    }
    // sort by number
    arr.sort((a, b) => a.number - b.number);
    return arr;
  }, [filteredTirages]);

  // Top 5 with delta vs global occurrences
  const top5 = useMemo(() => {
    // current filtered counts
    const curr = dynamicOccurrences.slice().sort((a, b) => b.count - a.count).slice(0, 5);
    // global map
    const globalMap = new Map<number, number>();
    occurrences.forEach((o) => globalMap.set(o.number, o.count));
    return curr.map((c) => {
      const global = globalMap.get(c.number) || 0;
      const delta = global === 0 ? null : ((c.count - global) / (global || 1)) * 100;
      return { ...c, delta };
    });
  }, [dynamicOccurrences, occurrences]);

  // heatmap colors
  const heatColor = (count: number) => {
    // simple scale: 0 -> #e6e6e6, max -> #004085 (dark blue)
    const max = Math.max(...dynamicOccurrences.map((d) => d.count), 1);
    const t = count / max;
    // interpolate green-blue depending on t
    const blue = [13, 110, 253]; // #0d6efd
    const green = [25, 135, 84]; // #198754
    const r = Math.round(green[0] * (1 - t) + blue[0] * t);
    const g = Math.round(green[1] * (1 - t) + blue[1] * t);
    const b = Math.round(green[2] * (1 - t) + blue[2] * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // sorted table data
  const tableData = useMemo(() => {
    const rows = numbersMeta.map((m) => ({
      number: m.number,
      count: m.count,
      lastSeen: m.lastSeen,
      firstSeen: m.firstSeen,
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

  // pagination
  const pageCount = Math.ceil(tableData.length / perPage);
  const pageRows = tableData.slice((page - 1) * perPage, page * perPage);

  // export table -> xlsx
  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [["Number", "Count", "Last Seen", "First Seen"], ...tableData.map((r) => [r.number, r.count, r.lastSeen || "-", r.firstSeen || "-"])];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Numbers");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout]), `numbers_stats_${Date.now()}.xlsx`);
  };

  // -------------------- UI --------------------
  return (
    <div className="py-6 max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Statistiques Lotto</h2>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
            Simuler Premium
          </label>

          <div className="flex items-center gap-2">
            <button onClick={() => setFullscreenChart("bar")} className="px-3 py-1 bg-gray-200 rounded">Fullscreen Bar</button>
            <button onClick={() => setFullscreenChart("heat")} className="px-3 py-1 bg-gray-200 rounded">Fullscreen Heat</button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button className={`px-3 py-1 rounded ${filterPreset==="all" ? "bg-blue-600 text-white" : "bg-gray-100"}`} onClick={() => setFilterPreset("all")}>All</button>
          <button className={`px-3 py-1 rounded ${filterPreset==="1m" ? "bg-blue-600 text-white" : "bg-gray-100"}`} onClick={() => setFilterPreset("1m")}>1M</button>
          <button className={`px-3 py-1 rounded ${filterPreset==="6m" ? "bg-blue-600 text-white" : "bg-gray-100"}`} onClick={() => setFilterPreset("6m")}>6M</button>
          <button className={`px-3 py-1 rounded ${filterPreset==="1y" ? "bg-blue-600 text-white" : "bg-gray-100"}`} onClick={() => setFilterPreset("1y")}>1Y</button>
          <button className={`px-3 py-1 rounded ${filterPreset==="custom" ? "bg-blue-600 text-white" : "bg-gray-100"}`} onClick={() => setFilterPreset("custom")}>Custom</button>
        </div>

        {filterPreset === "custom" && (
          <div className="flex gap-2 items-center">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="border rounded px-2 py-1" />
            <span>→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="border rounded px-2 py-1" />
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          <label className="text-sm">Per page
            <select className="ml-2 border rounded px-2 py-1" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>

          <button onClick={exportXLSX} className="px-3 py-1 bg-green-600 text-white rounded">Export XLSX</button>
        </div>
      </div>

      {/* Top cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
          <div className="text-sm text-gray-500">Total tirages chargés</div>
          <div className="text-2xl font-bold">{tirages.length}</div>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
          <div className="text-sm text-gray-500">Top 1 (dynamic)</div>
          <div className="text-2xl font-bold">
            {dynamicOccurrences.slice().sort((a,b)=>b.count-a.count)[0]?.number || "-"} ({dynamicOccurrences.slice().sort((a,b)=>b.count-a.count)[0]?.count || 0})
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
          <div className="text-sm text-gray-500">Note</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">Filtres dynamiques & export disponibles</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* Bar chart */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow h-72">
          <div className="text-sm font-semibold mb-2">Number Frequencies</div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dynamicOccurrences}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="number" />
              <YAxis />
              <Tooltip />
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
                  className="w-10 h-10 flex items-center justify-center rounded-full text-white font-semibold"
                  style={{ background: heatColor(d.count) }}
                >
                  {d.number}
                </div>
                <div className="text-xs text-gray-500">{d.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pie + Radar */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow h-72">
          <div className="text-sm font-semibold mb-2">Distribution / Patterns</div>
          <div className="flex h-full gap-2">
            <div className="w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dynamicOccurrences.slice(0, 6)}
                    dataKey="count"
                    nameKey="number"
                    innerRadius={20}
                    outerRadius={40}
                    isAnimationActive
                  >
                    {dynamicOccurrences.slice(0, 6).map((entry, idx) => (
                      <Cell key={entry.number} fill={idx % 2 === 0 ? "#0d6efd" : "#198754"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={dynamicOccurrences.slice(0, 8).map((d) => ({ number: `${d.number}`, count: d.count }))}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="number" />
                  <PolarRadiusAxis />
                  <Radar name="freq" dataKey="count" stroke="#0d6efd" fill="#0d6efd" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Top5 list */}
      <div className="mb-6">
        <div className="text-lg font-semibold mb-2">Top 5 (filtered)</div>
        <div className="flex gap-3">
          {top5.map((t) => (
            <div key={t.number} className="p-3 bg-white dark:bg-gray-800 rounded shadow flex-1">
              <div className="text-sm text-gray-500">#{t.number}</div>
              <div className="text-2xl font-bold">{t.count}</div>
              <div className="text-sm">
                {t.delta === null ? "-" : (t.delta > 0 ? <span className="text-green-600">+{t.delta.toFixed(1)}%</span> : <span className="text-red-600">{t.delta.toFixed(1)}%</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Numbers table</div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Sort by</label>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)} className="border rounded px-2 py-1">
              <option value="count">Count</option>
              <option value="number">Number</option>
              <option value="lastSeen">Last seen</option>
            </select>
            <button onClick={() => setSortDir((s) => (s === "asc" ? "desc" : "asc"))} className="px-2 py-1 border rounded">{sortDir === "asc" ? "↑" : "↓"}</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Count</th>
                <th className="px-3 py-2">Last seen</th>
                <th className="px-3 py-2">First seen</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.number} className="border-b">
                  <td className="px-3 py-2">{r.number}</td>
                  <td className="px-3 py-2">{r.count}</td>
                  <td className="px-3 py-2">{r.lastSeen ?? "-"}</td>
                  <td className="px-3 py-2">{r.firstSeen ?? "-"}</td>
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
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 border rounded">Prev</button>
            <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="px-3 py-1 border rounded">Next</button>
          </div>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {fullscreenChart && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded shadow w-full max-w-6xl h-full max-h-[90vh] p-4 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xl font-semibold">{fullscreenChart === "bar" ? "Bar chart (fullscreen)" : "Heatmap (fullscreen)"}</div>
              <button onClick={() => setFullscreenChart(null)} className="px-3 py-1 bg-gray-200 rounded">Close</button>
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
  );
}
