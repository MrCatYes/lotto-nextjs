"use client";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";

export default function ExportButtons({ tirages }) {
  const exportCSV = () => {
    const header = ["Date","Num1","Num2","Num3","Num4","Num5","Num6","Bonus","Premium"];
    const rows = tirages.map(t => [
      t.date, t.num1, t.num2, t.num3, t.num4, t.num5, t.num6, t.bonus, t.premium ? "Premium" : "Gratuit"
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    saveAs(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "tirages.csv");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    let y = 10;
    tirages.forEach(t => {
      doc.text(`${t.date}: ${t.num1},${t.num2},${t.num3},${t.num4},${t.num5},${t.num6} Bonus:${t.bonus} ${t.premium ? "[Premium]" : ""}`, 10, y);
      y += 8;
    });
    doc.save("tirages.pdf");
  };

  return (
    <div className="flex gap-2 mb-4">
      <button onClick={exportCSV} className="px-3 py-2 bg-green-600 text-white rounded">Exporter CSV</button>
      <button onClick={exportPDF} className="px-3 py-2 bg-red-600 text-white rounded">Exporter PDF</button>
    </div>
  );
}
