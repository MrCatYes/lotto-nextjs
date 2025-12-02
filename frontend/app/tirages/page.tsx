"use client";

import { useState, useEffect } from "react";
import { ApolloClient, InMemoryCache, HttpLink, gql } from "@apollo/client";
import DatePickerPopup from "@/components/DatePickerPopup";
import ExportMenu from "@/components/ExportMenu";

interface Tirage {
  id: string;
  date: string;
  num1: number;
  num2: number;
  num3: number;
  num4: number;
  num5: number;
  num6: number;
  bonus?: number;
  premium: boolean;
}

export default function TiragesPage() {
  const [tirages, setTirages] = useState<Tirage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [tiragesPerPage, setTiragesPerPage] = useState(10);
  const [isPremium] = useState(true); // simuler accès premium

  const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;

  const client = new ApolloClient({
    link: new HttpLink({
      uri: "http://localhost:4000/graphql",
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    }),
    cache: new InMemoryCache(),
  });

  // Fetch tirages
  const fetchTirages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.query({
        query: gql`
          query GetTirages($limit: Int!, $offset: Int!, $premium: Boolean!, $date: String, $year: Int, $month: Int) {
            tirages(limit: $limit, offset: $offset, premium: $premium, date: $date, year: $year, month: $month) {
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
        variables: {
          limit: tiragesPerPage,
          offset: 0,
          premium: isPremium,
          date: selectedDate || null,
          year: selectedYear || null,
          month: selectedMonth !== null ? selectedMonth : null,
        },
        fetchPolicy: "no-cache",
      });

      let allTirages: Tirage[] = res.data.tirages;

      // Limiter aux 2 années précédentes pour non-premium
      if (!isPremium) {
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        allTirages = allTirages.filter(t => new Date(t.date) >= twoYearsAgo);
      }

      // Trier par date décroissante
      allTirages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTirages(allTirages);
    } catch (err: any) {
      setError(err.message || "Erreur GraphQL");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTirages();
  }, [selectedDate, tiragesPerPage, selectedYear, selectedMonth]);

  // Années pour menu
  const currentYear = new Date().getFullYear();
  const years = isPremium
    ? Array.from({ length: 10 }, (_, i) => currentYear - i)
    : [currentYear, currentYear - 1, currentYear - 2];

  // Mois pour menu
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(0, i).toLocaleString("default", { month: "long" })
  );

  // Group tirages par mois
  const tiragesGroupedByMonth: { [monthYear: string]: Tirage[] } = {};
  tirages.forEach((t) => {
    const d = new Date(t.date);
    const monthYear = d.toLocaleString("default", { month: "long", year: "numeric" });
    if (!tiragesGroupedByMonth[monthYear]) tiragesGroupedByMonth[monthYear] = [];
    tiragesGroupedByMonth[monthYear].push(t);
  });

  const handleExportClick = () => {
    if (!isPremium) {
      alert("Seuls les abonnés premium peuvent télécharger les résultats.");
      return;
    }
    // TODO: ajouter menu export CSV/XLSX/PDF
  };

  return (
    <div className="py-6 max-w-6xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-6">Tirages Lotto</h1> 

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4 w-full bg-gray-50 dark:bg-gray-800 p-3 rounded shadow-sm">
        <div className="flex flex-0 flex-col sm:flex-row sm:items-end gap-2 w-full">
          {/* Conteneur DatePicker + bouton */}
          <div className="flex flex-1 gap-2 items-end">
            <div className="flex-1 flex flex-col">
              <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1">
                Select a Draw Date (YYYY-MM-DD)
              </label>
              <DatePickerPopup
                value={selectedDate}
                onChange={setSelectedDate}
                isPremium={isPremium}
              />
            </div>

            <button
              onClick={fetchTirages}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition h-10 flex-shrink-0"
            >
              Rechercher
            </button>
          </div>
        </div>

        {/* Conteneur Sélecteurs */}
        <div className="flex gap-2 items-end ml-auto">
          <label className="flex flex-col text-gray-700 dark:text-gray-300 text-sm">
            Tirages par page
            <select
              value={tiragesPerPage}
              onChange={e => setTiragesPerPage(Number(e.target.value))}
              className="border rounded px-2 py-2 text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 h-10"
            >
              {[10, 20, 50].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-gray-700 dark:text-gray-300 text-sm">
            Année
            <select
              value={selectedYear ?? ""}
              onChange={e => {
                setSelectedYear(e.target.value ? Number(e.target.value) : null);
                setSelectedDate("");
              }}
              className="border rounded px-2 py-2 text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 h-10"
            >
              <option value="">Toutes</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-gray-700 dark:text-gray-300 text-sm">
            Mois
            <select
              value={selectedMonth !== null ? selectedMonth : ""}
              onChange={e => {
                setSelectedMonth(e.target.value !== "" ? Number(e.target.value) : null);
                setSelectedDate("");
              }}
              className="border rounded px-2 py-2 text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 h-10"
            >
              <option value="">Tous</option>
              {months.map((month, i) => (
                <option key={i} value={i}>{month}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!isPremium && (
        <p className="text-yellow-600 mt-2">
          Seuls les utilisateurs premium ont accès aux données complètes et à la fonctionnalité d'export.
        </p>
      )}

      {loading && <p className="text-gray-600 dark:text-gray-300">Chargement...</p>}
      {error && <p className="text-red-500">Erreur: {error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded shadow mt-4">
          {Object.entries(tiragesGroupedByMonth).map(([month, tirages]) => (
            <div key={month} className="mb-4">
              <div className="px-4 py-2 bg-gray-200 dark:bg-gray-700 font-semibold rounded-t">
                {month}
              </div>
              <table className="min-w-full text-left">
                <tbody>
                  {tirages.map(t => (
                    <tr key={t.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">{t.date}</td>
                      <td className="px-4 py-3 flex gap-1 flex-wrap">
                        {[t.num1, t.num2, t.num3, t.num4, t.num5, t.num6].map((n, i) => (
                          <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">{n}</span>
                        ))}
                      </td>
                      <td className="px-4 py-3">{t.bonus ?? "-"}</td>
                      <td className="px-4 py-3">{t.premium ? "Premium" : "Gratuit"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

<ExportMenu tirages={tirages} />
    </div>
  );
}
