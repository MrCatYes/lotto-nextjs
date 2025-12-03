"use client";

import { useState, useEffect } from "react";
import { ApolloClient, InMemoryCache, HttpLink, gql } from "@apollo/client";
import DatePickerPopup from "@/components/DatePickerPopup";
import ExportMenu from "@/components/ExportMenu";

import { Listbox } from "@headlessui/react";
import { Fragment } from "react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
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

      if (!isPremium) {
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        allTirages = allTirages.filter(t => new Date(t.date) >= twoYearsAgo);
      }

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

  const currentYear = new Date().getFullYear();
  const years = isPremium
    ? Array.from({ length: 10 }, (_, i) => currentYear - i)
    : [currentYear, currentYear - 1, currentYear - 2];

  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(0, i).toLocaleString("default", { month: "long" })
  );

  tirages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const tiragesGroupedByMonth: { [monthYear: string]: Tirage[] } = {};
  
  tirages.forEach((t) => {
    // Extraire année et mois directement depuis la string ISO (YYYY-MM-DD)
    const [yearStr, monthStr] = t.date.split("-");
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) ; // JS months: 0-11
    const monthName = new Date(Date.UTC(year, monthIndex)).toLocaleString("en-US", { month: "long" });
  
    const monthYear = `${monthName} ${year}`;
  
    if (!tiragesGroupedByMonth[monthYear]) tiragesGroupedByMonth[monthYear] = [];
    tiragesGroupedByMonth[monthYear].push(t);
  });

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
              className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700 transition h-10 shrink-0"
            >
              Rechercher
            </button>
          </div>
        </div>

        {/* Conteneur Sélecteurs */}
        <div className="flex gap-3 items-end ml-auto">
        {/* Tirages par page */}
        <Listbox value={tiragesPerPage} onChange={setTiragesPerPage}>
          <div className="relative w-32">
            <Listbox.Button className="relative w-full cursor-pointer rounded border border-gray-300 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-400 flex justify-between items-center">
              {tiragesPerPage}
              <ChevronUpDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-300" />
            </Listbox.Button>
            <Listbox.Options className="absolute z-10 mt-1 w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg max-h-60 overflow-auto">
              {[10, 20, 50].map((n) => (
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

        {/* Année */}
        <Listbox value={selectedYear} onChange={(val) => { setSelectedYear(val); setSelectedDate(""); }}>
          <div className="relative w-32">
            <Listbox.Button className="relative w-full cursor-pointer rounded border border-gray-300 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-400 flex justify-between items-center">
              {selectedYear ?? "Toutes"}
              <ChevronUpDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-300" />
            </Listbox.Button>
            <Listbox.Options className="absolute z-10 mt-1 w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg max-h-60 overflow-auto">
              <Listbox.Option value={null} as={Fragment}>
                {({ active, selected }) => (
                  <li
                    className={`cursor-pointer px-3 py-2 ${
                      active ? "bg-gray-600 text-white" : "text-gray-900 dark:text-gray-100"
                    } ${selected ? "font-bold" : ""}`}
                  >
                    Toutes
                  </li>
                )}
              </Listbox.Option>
              {years.map((year) => (
                <Listbox.Option key={year} value={year} as={Fragment}>
                  {({ active, selected }) => (
                    <li
                      className={`cursor-pointer px-3 py-2 ${
                        active ? "bg-gray-600 text-white" : "text-gray-900 dark:text-gray-100"
                      } ${selected ? "font-bold" : ""}`}
                    >
                      {year}
                    </li>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        </Listbox>

        {/* Mois */}
        <Listbox value={selectedMonth} onChange={(val) => { setSelectedMonth(val); setSelectedDate(""); }}>
          <div className="relative w-32">
            <Listbox.Button className="relative w-full cursor-pointer rounded border border-gray-300 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-400 flex justify-between items-center">
              {selectedMonth !== null ? months[selectedMonth] : "Tous"}
              <ChevronUpDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-300" />
            </Listbox.Button>
            <Listbox.Options className="absolute z-10 mt-1 w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg max-h-60 overflow-auto">
              <Listbox.Option value={null} as={Fragment}>
                {({ active, selected }) => (
                  <li
                    className={`cursor-pointer px-3 py-2 ${
                      active ? "bg-blue-600 text-white" : "text-gray-900 dark:text-gray-100"
                    } ${selected ? "font-bold" : ""}`}
                  >
                    Tous
                  </li>
                )}
              </Listbox.Option>
              {months.map((month, i) => (
                <Listbox.Option key={i} value={i} as={Fragment}>
                  {({ active, selected }) => (
                    <li
                      className={`cursor-pointer px-3 py-2 ${
                        active ? "bg-blue-600 text-white" : "text-gray-900 dark:text-gray-100"
                      } ${selected ? "font-bold" : ""}`}
                    >
                      {month}
                    </li>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        </Listbox>
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
            <div className="relative px-4 py-2 bg-gray-200 dark:bg-gray-700 font-semibold rounded-t text-gray-800 dark:text-gray-100">
              
              {/* Mois & année (à gauche) */}
              <span className="text-left block">{month}</span>

              {/* Winning Numbers centré absolument */}
              <span className="absolute left-3/5 top-1/2 -translate-x-1/2 -translate-y-1/2">
                Winning Numbers
              </span>
          </div>

            <table className="min-w-full text-left">
              <tbody>
                {tirages.map(t => (
                  <tr key={t.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3">{t.date}</td>
                    <td className="px-4 py-3 flex gap-2 flex-wrap justify-center items-center">
                      {/* Boules principales */}
                      {[t.num1, t.num2, t.num3, t.num4, t.num5, t.num6].map((n, i) => {
                        const colors = ["#0d6efd", "#198754"];
                        const color = colors[i % colors.length];
                        return (
                          <span
                            key={i}
                            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full text-white font-bold text-sm md:text-base shadow-lg flex-shrink-0 transition-transform transform hover:scale-110"
                            style={{
                              background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5), ${color})`,
                            }}
                          >
                            {n}
                          </span>
                        );
                      })}

                      {/* Signe + */}
                      {t.bonus !== undefined && <span className="text-lg font-bold text-gray-700">+</span>}

                      {/* Boule bonus */}
                      {t.bonus !== undefined && (
                        <span
                          className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full text-white font-bold text-sm md:text-base shadow-lg flex-shrink-0 transition-transform transform hover:scale-110"
                          style={{
                            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5), #ffc107)`,
                          }}
                        >
                          {t.bonus}
                          {/* Pastille BB style Lotto Max */}
                          <span className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-red-600 text-white font-bold rounded-full w-6 h-6 flex items-center justify-center text-xs md:text-sm shadow">
                            BB
                          </span>
                        </span>
                      )}
                    </td>
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
