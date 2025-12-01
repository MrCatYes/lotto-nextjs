"use client";

import { useEffect, useState, useMemo } from "react";
import { ApolloClient, InMemoryCache, HttpLink, gql } from "@apollo/client";
import Link from "next/link";

export default function TiragesPage() {
  const [tirages, setTirages] = useState([]);
  const [q, setQ] = useState("");
  const [onlyPremium, setOnlyPremium] = useState(false);
  const [limit, setLimit] = useState(50);

  const client = useMemo(() => new ApolloClient({
    link: new HttpLink({ uri: "http://localhost:4000/graphql" }),
    cache: new InMemoryCache(),
  }), []);

  useEffect(() => {
    client.query({
      query: gql`
        query ($limit: Int, $premium: Boolean) {
          tirages(limit: $limit, premium: $premium) {
            id date num1 num2 num3 num4 num5 num6 bonus premium
          }
        }
      `,
      variables: { limit, premium: onlyPremium }
    }).then(res => {
      setTirages(res.data.tirages || []);
    }).catch(console.error);
  }, [client, limit, onlyPremium]);

  const filtered = useMemo(() => {
    if (!q) return tirages;
    const lw = q.toLowerCase();
    return tirages.filter(t =>
      t.date?.toLowerCase().includes(lw) ||
      [t.num1,t.num2,t.num3,t.num4,t.num5,t.num6,t.bonus].some(n => String(n).includes(lw))
    );
  }, [tirages, q]);

  return (
    <div className="py-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-semibold">Tirages</h2>

        <div className="flex gap-2 items-center">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Recherche date ou numéro" className="px-3 py-2 border rounded" />
          <select value={limit} onChange={e=>setLimit(Number(e.target.value))} className="px-3 py-2 border rounded">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={onlyPremium} onChange={e=>setOnlyPremium(e.target.checked)} />
            Premium only
          </label>
        </div>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded shadow">
        <table className="min-w-full text-left">
          <thead className="border-b">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">N°</th>
              <th className="px-4 py-3">Bonus</th>
              <th className="px-4 py-3">Tag</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3">{t.date}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 flex-wrap">
                    {[t.num1,t.num2,t.num3,t.num4,t.num5,t.num6].map((n,i)=>(
                      <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">{n}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">{t.bonus ?? "-"}</td>
                <td className="px-4 py-3">{t.premium ? <span className="text-sm px-2 py-1 bg-yellow-100 dark:bg-yellow-800 rounded">Premium</span> : "Gratuit"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p>{filtered.length} tirages affichés.</p>
        <p>Astuce: utilise la recherche pour trouver une date (YYYY-MM-DD) ou numéro.</p>
      </div>
    </div>
  );
}
