"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const onLogin = async (e) => {
    e.preventDefault();
    setMsg("Connexion en cours...");

    try {
      const res = await fetch("http://localhost:4000/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem("adminToken", data.token);
        router.push("/admin/dashboard");
      } else {
        setMsg("Erreur: " + (data.error || JSON.stringify(data)));
      }
    } catch (err) {
      setMsg("Erreur réseau: " + err.message);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <form onSubmit={onLogin} className="bg-white dark:bg-gray-800 p-6 rounded shadow w-full max-w-sm space-y-4">
        <h2 className="text-xl font-bold">Connexion Admin</h2>
        <input
          type="text"
          placeholder="Nom d'utilisateur"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full px-3 py-2 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded"
          required
        />
        <button type="submit" className="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">
          Se connecter
        </button>
        {msg && <p className="text-sm text-red-500">{msg}</p>}
      </form>
    </div>
  );
}
