import { useRef, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

interface Tirage {
  id: string;
  date: string;
  num1: number;
  num2: number;
  num3: number;
  num4: number;
  num5: number;
  num6: number;
  num7: number;
  bonus?: number;
  premium: boolean;
}

interface ExportMenuProps {
  tirages: Tirage[];
}

export default function ExportMenu({ tirages }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu si clic en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Data pour export
  const exportData = tirages.map(t => ({
    date: t.date,
    numéros: `${t.num1} ${t.num2} ${t.num3} ${t.num4} ${t.num5} ${t.num6} ${t.num7}`,
    bonus: t.bonus ?? "",
    premium: t.premium ? "Oui" : "Non",
  }));

  /* ------------------------------
      EXPORT CSV
  -------------------------------*/
  const exportCSV = () => {
    const rows = [
      ["Date", "Numéros", "Bonus", "Premium"],
      ...exportData.map(t => [t.date, t.numéros, t.bonus, t.premium])
    ];

    const csv = rows.map(r => r.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "tirages.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ------------------------------
      EXPORT XLSX
  -------------------------------*/
  const exportXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tirages");
    XLSX.writeFile(wb, "tirages.xlsx");
  };

  /* ------------------------------
      EXPORT PDF
  -------------------------------*/
  const exportPDF = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(14);
    pdf.text("Tirages Lotto", 10, 10);

    let y = 20;
    exportData.forEach(t => {
      pdf.text(`${t.date} - ${t.numéros} (Bonus: ${t.bonus})`, 10, y);
      y += 8;
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }
    });

    pdf.save("tirages.pdf");
  };

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
              className="px-3 py-2 bg-gray-900 text-white rounded hover:bg-gray-700 transition h-10 shrink-0 mt-4"
      >
        Export
      </button>

      {/* MENU EXPORT */}
      {open && (
        <div
          className="absolute top-full left-0 w-40 dark:bg-gray-800 border rounded shadow z-20 
                     animate-fadeIn"
        >
          <button
            onClick={exportCSV}
            className="block w-full px-3 py-2 text-left hover:bg-gray-600"
          >
            📄 CSV
          </button>

          <button
            onClick={exportXLSX}
            className="block w-full px-3 py-2 text-left hover:bg-gray-600"
          >
            📊 XLSX
          </button>

          <button
            onClick={exportPDF}
            className="block w-full px-3 py-2 text-left hover:bg-gray-600"
          >
            🧾 PDF
          </button>
        </div>
      )}

      {/* Animation Tailwind */}
      <style>{`
        .animate-fadeIn {
          animation: fadeIn 0.25s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
