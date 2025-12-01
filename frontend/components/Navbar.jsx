// components/Navbar.jsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const preferred = saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

    setTheme(preferred);
    document.documentElement.classList.toggle("dark", preferred === "dark");
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <header className="fixed top-0 left-0 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg shadow-md z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        <h1 className="text-xl font-bold">Lotto Viewer</h1>

        {/* Desktop Menu */}
        <nav className="hidden md:flex gap-6 text-blue-600 dark:text-blue-400 font-medium">
          <Link href="/">Accueil</Link>
          <Link href="/tirages">Tirages</Link>
          <Link href="/probabilite">Probabilité</Link>
          <Link href="/stats">Statistiques</Link>
          <a href="https://github.com/TonUtilisateur/lotto-nextjs" target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>

        {/* Theme toggle desktop */}
        <button
          onClick={toggleTheme}
          className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full bg-gray-200 dark:bg-gray-700 shadow-sm transition hover:scale-105"
        >
          {theme === "light" ? "🌙" : "☀️"}
          <span className="text-sm">{theme === "light" ? "Sombre" : "Clair"}</span>
        </button>

        {/* Hamburger button */}
        <button
          className="md:hidden p-2 rounded-lg bg-gray-200 dark:bg-gray-700"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "✖" : "☰"}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="md:hidden flex flex-col gap-4 px-6 pb-4 text-blue-600 dark:text-blue-400 font-medium animate-fadeIn">
          <Link href="/" onClick={() => setMenuOpen(false)}>Accueil</Link>
          <Link href="/tirages" onClick={() => setMenuOpen(false)}>Tirages</Link>
          <Link href="/probabilite" onClick={() => setMenuOpen(false)}>Probabilité</Link>
          <Link href="/stats" onClick={() => setMenuOpen(false)}>Statistiques</Link>
          <a href="https://github.com/TonUtilisateur/lotto-nextjs" target="_blank" rel="noopener noreferrer">GitHub</a>

          {/* Theme toggle mobile */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-200 dark:bg-gray-700 shadow-sm w-fit transition hover:scale-105"
          >
            {theme === "light" ? "🌙" : "☀️"}
            <span className="text-sm">{theme === "light" ? "Sombre" : "Clair"}</span>
          </button>
        </nav>
      )}
    </header>
  );
}
