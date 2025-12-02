"use client";
import { useState } from "react";

export default function PremiumPage() {
  const [status, setStatus] = useState(null);

  const buyMock = () => {
    // simulate payment success
    localStorage.setItem("isPremium","1");
    setStatus("success");
  };

  return (
    <div className="py-6">
      <h2 className="text-2xl font-semibold">Abonnement Premium (Demo)</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Dans la vraie app, ici tu intègres Stripe. Pour la démo on active un flag local.</p>

      <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded shadow">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Plan Premium</h3>
            <p className="text-sm text-gray-600">Accès historique complet, statistiques avancées, export.</p>
          </div>
          <div>
            <button onClick={buyMock} className="px-4 py-2 bg-green-600 text-white rounded">Activer (Demo)</button>
          </div>
        </div>
        {status==="success" && <p className="mt-3 text-green-500">Premium activé (demo).</p>}
      </div>
    </div>
  );
}
