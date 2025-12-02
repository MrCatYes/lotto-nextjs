"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PremiumGuard({ children }) {
    const [isPremium, setIsPremium] = useState(
        typeof window !== "undefined" && localStorage.getItem("isPremium") === "1"
      );
        const router = useRouter();


  if (!isPremium) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded shadow">
        <h3 className="text-lg font-semibold">Fonctionnalité Premium</h3>
        <p className="mt-2 text-sm">Cette section est réservée aux abonnés premium.</p>
        <div className="mt-4 flex gap-2">
          <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => {
            localStorage.setItem("isPremium","1");
            setIsPremium(true);
          }}>Activer demo Premium</button>
          <button className="px-3 py-2 border rounded" onClick={() => router.push("/premium")}>En savoir plus</button>
        </div>
      </div>
    );
  }

  return children;
}
