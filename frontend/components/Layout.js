import Link from "next/link";

export default function Layout({ children }) {
  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 20 }}>
        <h1>Lotto Viewer</h1>
        <nav>
          <Link href="/">Accueil</Link> | {" "}
          <Link href="/tirages">Tirages</Link> | {" "}
          <Link href="/probabilite">ProbabilitÃ©</Link> | {" "}
          <a href="https://github.com/TON_UTILISATEUR/lotto-nextjs" target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
