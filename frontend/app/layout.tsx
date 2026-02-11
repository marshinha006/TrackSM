import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import Link from "next/link";
import NavAuth from "./components/nav-auth";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "TrackSM",
  description: "Rastreador de series com Go e Next.js",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={spaceGrotesk.variable}>
      <body>
        <div className="site-shell">
          <nav className="site-nav" aria-label="Principal">
            <div className="nav-menu">
              <Link href="/" className="nav-link">
                Home
              </Link>
              <Link href="/minhas-series" className="nav-link">
                Minhas series
              </Link>
              <Link href="/calendario" className="nav-link">
                Calendario
              </Link>
              <Link href="/explorar" className="nav-link">
                Explorar
              </Link>
            </div>
            <Link href="/" className="brand-link" aria-label="TrackSM - pagina inicial">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="brand-logo"
                src="/logo-without-name.svg"
                alt="Logo TrackSM"
                width={34}
                height={34}
              />
              <span className="brand-name">
                TRACK<span className="brand-name-accent">SM</span>
              </span>
            </Link>
            <div className="nav-spacer">
              <NavAuth />
            </div>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
