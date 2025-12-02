"use client";

import { useEffect, useRef, useState } from "react";
import { ApolloClient, InMemoryCache, HttpLink, gql } from "@apollo/client";

interface DatePickerPopupProps {
  value: string;
  onChange: (date: string) => void;
  isPremium?: boolean;
}

type ViewMode = "days" | "months" | "years";

export default function DatePickerPopup({
  value,
  onChange,
  isPremium = true,
}: DatePickerPopupProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ViewMode>("days");
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [yearsRange, setYearsRange] = useState<number[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;

  const client = new ApolloClient({
    link: new HttpLink({
      uri: "http://localhost:4000/graphql",
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    }),
    cache: new InMemoryCache(),
  });

  // Charger les dates disponibles
  const fetchAvailableDates = async () => {
    try {
      const res = await client.query({
        query: gql`
          query GetAvailableDates($premium: Boolean!) {
            availableDates(premium: $premium)
          }
        `,
        variables: { premium: isPremium },
        fetchPolicy: "no-cache",
      });

      const dates: string[] = res.data.availableDates;
      setAvailableDates(dates);

      const years = [...new Set(dates.map((d) => Number(d.split("-")[0])))].sort(
        (a, b) => b - a
      );
      setYearsRange(years);
    } catch (err) {
      console.error("Erreur availableDates:", err);
    }
  };

  useEffect(() => {
    fetchAvailableDates();
  }, [isPremium]);

  // Fermer le popup si clic en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = () => setOpen(!open);

  const minYear = yearsRange[yearsRange.length - 1] ?? currentYear;
  const maxYear = yearsRange[0] ?? currentYear;

  const goPrevMonth = () => {
    if (currentYear === minYear && currentMonth === 0) return;
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (currentYear === maxYear && currentMonth === 11) return;
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sunday

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    const date = new Date(val);
    if (!isNaN(date.getTime())) {
      setCurrentYear(date.getFullYear());
      setCurrentMonth(date.getMonth());
      setMode("days");
    }
  };

  const renderDays = () => {
    const days = [];
    const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    // Légende des jours
    const legend = weekDays.map((d) => (
      <div
        key={d}
        className="text-center font-semibold text-gray-700 dark:text-gray-200"
      >
        {d}
      </div>
    ));

    // Cases vides avant le premier jour du mois
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} />);
    }

    // Jours du mois
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(
        2,
        "0"
      )}-${String(i).padStart(2, "0")}`;
      const isAvailable = availableDates.includes(dateStr);
      const isSelected = value === dateStr;

      days.push(
        <button
          key={i}
          disabled={!isAvailable}
          onClick={() => {
            onChange(dateStr);
            setOpen(false);
          }}
          className={`
            w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded
            text-sm md:text-base transition
            ${isAvailable ? "text-blue-700 font-semibold" : "text-gray-400 cursor-not-allowed"}
            ${isSelected ? "bg-blue-600 text-white" : "hover:bg-blue-100 dark:hover:bg-gray-700"}
          `}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {legend}
        {days}
      </div>
    );
  };

  const renderMonths = () => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return months.map((m, idx) => (
      <button
        key={idx}
        onClick={() => {
          setCurrentMonth(idx);
          setMode("days");
        }}
        className="p-4 md:p-3 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-sm md:text-base"
      >
        {m}
      </button>
    ));
  };

  const renderYears = () => {
    return yearsRange.map((y) => (
      <button
        key={y}
        onClick={() => {
          setCurrentYear(y);
          setMode("months");
        }}
        className="p-4 md:p-3 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-sm md:text-base"
      >
        {y}
      </button>
    ));
  };

  return (
    <div ref={containerRef} className="relative w-full md:w-auto">
      {/* Barre de recherche + bouton intégré */}
      <div className="relative w-full md:w-72">
  <input
    type="text"
    value={value}
    onChange={handleInputChange}
    placeholder="YYYY-MM-DD"
    className="w-full px-3 py-2 pr-10 border rounded text-gray-900 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
  />
  {/* Bouton calendrier positionné à l'intérieur */}
  <button
    onClick={toggle}
    className="absolute right-1 top-1/2 transform -translate-y-1/2 px-2 py-1 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
  >
    📅
  </button>
      </div>

      {/* Popup calendrier */}
      <div
        className={`absolute mt-2 bg-white dark:bg-gray-800 shadow rounded p-4 z-50 w-72 md:w-80 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex justify-between items-center mb-3">
          <button
            onClick={goPrevMonth}
            className="px-2 py-1 text-xl hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            ◀
          </button>
          <div
            className="font-bold text-gray-900 dark:text-gray-200 cursor-pointer"
            onClick={() =>
              setMode(mode === "days" ? "months" : mode === "months" ? "years" : "years")
            }
          >
            {mode === "days" &&
              `${new Date(currentYear, currentMonth).toLocaleString("default", {
                month: "long",
              })} ${currentYear}`}
            {mode === "months" && currentYear}
            {mode === "years" && "Années"}
          </div>
          <button
            onClick={goNextMonth}
            className="px-2 py-1 text-xl hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            ▶
          </button>
        </div>

        {mode === "days" && renderDays()}
        {mode === "months" && <div className="grid grid-cols-3 gap-2">{renderMonths()}</div>}
        {mode === "years" && (
          <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">{renderYears()}</div>
        )}
      </div>
    </div>
  );
}
