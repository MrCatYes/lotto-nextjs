import "./globals.css";
import Navbar from "../components/Navbar";  // ← IMPORT IMPORTANT
import Footer from "../components/Footer";

export const metadata = {
  title: "Lotto Viewer",
  description: "Analyse Lotto",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="bg-gray-100 dark:bg-gray-900 transition-colors">
        
        {/* NAVBAR FIXÉE EN HAUT */}
        <Navbar />

        {/* CONTENU DES PAGES */}
        <main className="max-w-6xl mx-auto px-4 pt-24 pb-10">
          {children}
        </main>
        <Footer />

      </body>
    </html>
  );
}
