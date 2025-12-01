"use client";

import { useEffect, useState } from "react";
import { ApolloClient, InMemoryCache, HttpLink, gql } from "@apollo/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const client = new ApolloClient({
  link: new HttpLink({ uri: "http://localhost:4000/graphql" }),
  cache: new InMemoryCache(),
});

export default function StatsPage() {
  const [data, setData] = useState([]);
  const [isPremium, setIsPremium] = useState(false);
  const [summary, setSummary] = useState({ total:0, most: null });

  useEffect(() => {
    client.query({
      query: gql`
        query($premium:Boolean) {
          occurrences(premium:$premium) { number count }
        }
      `,
      variables: { premium: isPremium }
    }).then(res => {
      const arr = res.data.occurrences.map(o => ({ number:o.number, count:o.count }));
      setData(arr);
      const total = arr.reduce((s,a)=>s+a.count, 0);
      const most = arr.slice().sort((a,b)=>b.count-a.count)[0] || null;
      setSummary({ total, most });
    }).catch(console.error);
  }, [isPremium]);

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Statistiques</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isPremium} onChange={e=>setIsPremium(e.target.checked)} />
          Simuler Premium
        </label>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
          <div className="text-sm text-gray-500">Total numéros (comptés)</div>
          <div className="text-2xl font-bold">{summary.total}</div>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
          <div className="text-sm text-gray-500">Numéro le plus fréquent</div>
          <div className="text-2xl font-bold">{summary.most ? `${summary.most.number} (${summary.most.count})` : "-"}</div>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
          <div className="text-sm text-gray-500">Remarque</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">Les fréquences reposent sur l'historique sélectionné (premium/non-premium)</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <BarChart width={900} height={400} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="number" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" />
        </BarChart>
      </div>
    </div>
  );
}
