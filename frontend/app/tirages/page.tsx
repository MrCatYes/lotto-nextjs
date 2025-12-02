"use client";

import { useState, useEffect, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ApolloClient, InMemoryCache, HttpLink, gql } from "@apollo/client";

interface DatePickerPopupProps {
  value: string;
  onChange: (date: string) => void;
  isPremium: boolean;
  token?: string | null;
}

export default function DatePickerPopup({
  value,
  onChange,
  isPremium,
  token,
}: DatePickerPopupProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"day" | "month" | "year">("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const selectedDate = value ? new Date(value) : null;
  const containerRef = useRef<HTMLDivElement>(null);

  // Apollo Client
  const client = new ApolloClient({
    link: new HttpLink({
      uri: "http://localhost:4000/graphql",
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    }),
    cache: new InMemoryCache(),
  });

  // Fetch dates disponibles
  useEffect(() => {
    const fetchAvailableDates = async () => {
      try {
        const res = await client.query({
          query: gql`
            query AvailableDates($premium: Boolean!) {
              availableDates(premium: $premium)
            }
          `,
          variables: { premium: isPremium },
          fetchPolicy: "no-cache",
        });
        setAvailableDates(res.data.availableDates);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAvailableDates();
  }, [isPremium]);

  // Fermer popup au clic hors composant
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setView("day");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Header dynamique
  const getHeaderLabel = () => {
    if (view === "day") return currentDate.toLocaleString("default", { month: "long", year: "numeric" });
    if (view === "month") return currentDate.getFullYear().toString();
    if (view === "year") return `Années`;
  };

  const handleHeaderClick = () => {
    if (view === "day") setView("month");
    else if (view === "month") setView("year");
  };

  const handleYearSelect = (year: number) => {
    setCurrentDate(new Date(year, currentDate.getMonth(), 1));
    setView("month");
  };

  const handleMonthSelect = (month: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), month, 1));
    setView("day");
  };

  const handleDayClick = (date: Date) => {
    const iso = date.toISOString().split("T")[0];
    if (availableDates.includes(iso)) {
      onChange(iso);
      setCurrentDate(date);
      setOpen(false);
      setView("day");
    }
  };

  // Déterminer min/max années
  const yearsAll = availableDates.map(d => new Date(d).getFullYear());
  const maxYear = Math.max(...yearsAll, new Date().getFullYear());
  const minYear = isPremium ? Math.min(...yearsAll) : Math.max(...yearsAll) - 2;

  return (
    <div className="relative inline-block w-52" ref={containerRef}>
      <div className="relative">
        <DatePicker
          selected={selectedDate}
          onChange={handleDayClick}
          open={open}
          onInputClick={() => setOpen(true)}
          onClickOutside={() => setOpen(false)}
          placeholderText="YYYY-MM-DD"
          className="border px-3 py-2 rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          dateFormat="yyyy-MM-dd"
          minDate={new Date(minYear, 0, 1)}
          maxDate={new Date(maxYear, 11, 31)}
          showMonthYearPicker={view === "month"}
          showYearPicker={view === "year"}
          dayClassName={(date: Date) => {
            const iso = date.toISOString().split("T")[0];
            const isAvailable = availableDates.includes(iso);
            return isAvailable
              ? "text-blue-700 cursor-pointer hover:bg-blue-100 rounded"
              : "text-gray-400 pointer-events-none";
          }}
          renderCustomHeader={({ decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
            <div className="flex justify-between items-center px-2 py-1 bg-gray-100 rounded-t">
              <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled} className="p-1 hover:bg-gray-200 rounded">{"<"}</button>
              <span className="font-semibold cursor-pointer" onClick={handleHeaderClick}>
                {getHeaderLabel()}
              </span>
              <button onClick={increaseMonth} disabled={nextMonthButtonDisabled} className="p-1 hover:bg-gray-200 rounded">{">"}</button>
            </div>
          )}
        />

        {/* Vue Années */}
        {view === "year" && (
          <div className="absolute top-full left-0 w-full bg-white border mt-1 p-2 grid grid-cols-4 gap-2 max-h-64 overflow-auto z-10 rounded shadow-lg">
            {Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i).map((year) => (
              <button
                key={year}
                className="p-1 hover:bg-blue-100 rounded text-center text-blue-700"
                onClick={() => handleYearSelect(year)}
              >
                {year}
              </button>
            ))}
          </div>
        )}

        {/* Vue Mois */}
        {view === "month" && (
          <div className="absolute top-full left-0 w-full bg-white border mt-1 p-2 grid grid-cols-3 gap-2 z-10 rounded shadow-lg">
            {Array.from({ length: 12 }, (_, i) =>
              new Date(0, i).toLocaleString("default", { month: "short" })
            ).map((monthName, index) => (
              <button
                key={index}
                className="p-1 hover:bg-blue-100 rounded text-center text-blue-700"
                onClick={() => handleMonthSelect(index)}
              >
                {monthName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bouton calendrier */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="absolute right-0 top-0 h-full px-2 flex items-center justify-center border-l bg-gray-100 hover:bg-gray-200 rounded-r"
      >
        📅
      </button>
    </div>
  );
}
