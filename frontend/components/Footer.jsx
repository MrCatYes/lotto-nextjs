"use client";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-12 border-t bg-transparent border-gray-200 dark:border-gray-800 py-8">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-semibold">Lotto Viewer</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
            Analyse des tirages, statistiques et outils de probabilités — Projet portfolio.
          </p>
        </div>

        <div className="flex gap-8">


          <div>
            <h4 className="font-medium">Repo</h4>
            <ul className="mt-2 text-sm space-y-1">
              <li><a href="https://github.com/TonUtilisateur/lotto-nextjs" target="_blank" rel="noreferrer">GitHub</a></li>
            </ul>
          </div>
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} Lotto Viewer · Made by <strong>MrCatYes</strong>
        </div>
      </div>
    </footer>
  );
}
