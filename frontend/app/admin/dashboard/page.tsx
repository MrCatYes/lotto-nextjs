"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ApolloClient, InMemoryCache, HttpLink, gql } from "@apollo/client";

type TiragesQueryResult = {
  tirages: {
    id: string;
    date: string;
    num1: number;
    num2: number;
    num3: number;
    num4: number;
    num5: number;
    num6: number;
    num7: number;
    bonus?: number;
    premium: boolean;
  }[];
};

export default function AdminDashboard() {
  const router = useRouter();
  const [tirages, setTirages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Récupérer token côté client seulement
  useEffect(() => {
    const t = localStorage.getItem("adminToken");
    if (!t) {
      router.push("/admin/login");
    } else {
      setToken(t);
    }
  }, [router]);

  // Créer ApolloClient après que token soit disponible
  const client = useMemo(() => {
    if (!token) return null;
    return new ApolloClient({
      link: new HttpLink({
        uri: "http://localhost:4000/graphql",
        headers: { Authorization: `Bearer ${token}` },
      }),
      cache: new InMemoryCache(),
    });
  }, [token]);

  const fetchTirages = async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.query<TiragesQueryResult>({
        query: gql`
          query GetTirages($limit: Int!, $premium: Boolean!) {
            tirages(limit: $limit, premium: $premium) {
              id date num1 num2 num3 num4 num5 num6 num7 bonus premium
            }
          }
        `,
        variables: { limit: 20, premium: true },
        fetchPolicy: "no-cache",
      });
      setTirages(res.data?.tirages ?? []);
    } catch (err: any) {
      setError(err.message || "Erreur GraphQL");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard Admin</h1>

      <div className="mb-4 flex gap-3">
        <button
          onClick={fetchTirages}
          className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          disabled={!token || loading}
        >
          Charger tirages premium
        </button>
      </div>

      {loading && <p>Chargement...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && tirages.length > 0 && (
        <table className="min-w-full bg-white dark:bg-gray-800 rounded shadow">
          <thead className="border-b bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Numéros</th>
              <th className="px-4 py-2">Bonus</th>
              <th className="px-4 py-2">Type</th>
            </tr>
          </thead>
          <tbody>
            {tirages.map((t) => (
              <tr
                key={t.id}
                className="border-b hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td className="px-4 py-2">{t.date}</td>
                <td className="px-4 py-2 flex gap-1 flex-wrap">
                  {[t.num1, t.num2, t.num3, t.num4, t.num5, t.num6, t.num7].map(
                    (n, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm"
                      >
                        {n}
                      </span>
                    )
                  )}
                </td>
                <td className="px-4 py-2">{t.bonus ?? "-"}</td>
                <td className="px-4 py-2">{t.premium ? "Premium" : "Gratuit"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
