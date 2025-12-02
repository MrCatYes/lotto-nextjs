"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({ children }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) router.push("/admin/login");
  }, []);

  const logout = () => {
    localStorage.removeItem("adminToken");
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-lg font-bold">Admin Dashboard</h1>
        <button onClick={logout} className="px-3 py-1 border rounded bg-white text-blue-600 hover:bg-gray-200">
          Déconnexion
        </button>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
