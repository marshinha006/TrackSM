import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import Link from "next/link";
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
            <Link href="/" className="brand-link" aria-label="TrackSM - pagina inicial">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="brand-logo"
                src="/logo-with-name.svg"
                alt="Logo TrackSM"
                width={42}
                height={42}
              />
            </Link>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
