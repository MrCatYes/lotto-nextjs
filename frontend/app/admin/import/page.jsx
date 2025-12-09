"use client";

import { useState } from "react";

export default function AdminImportPage() {
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");

  const onUpload = async () => {
    if (!file) return alert("Choisis un CSV");

    const token = localStorage.getItem("adminToken");
    if (!token) return alert("Tu dois être connecté en tant qu'admin !");

    const fd = new FormData();
    fd.append("file", file);
    setMsg("Import en cours...");

    try {
      const res = await fetch("http://localhost:4000/admin/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const data = await res.json();
      if (res.ok) setMsg("Import réussi: " + (data.out || "OK"));
      else setMsg("Erreur: " + (data.error || JSON.stringify(data)));
    } catch (err) {
      setMsg("Erreur réseau: " + err.message);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded shadow max-w-md mx-auto mt-6">
      <h2 className="text-xl font-semibold mb-2">Importer des tirages</h2>
      <input type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      <div className="mt-3 flex gap-3">
        <button onClick={onUpload} className="px-3 py-2 bg-blue-600 text-white rounded">Importer</button>
      </div>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </div>
  );
}
