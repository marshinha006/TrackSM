"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StoredAuth = {
  name?: string;
  email?: string;
};

export default function MinhasSeriesPage() {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tracksm_auth");
      if (raw) {
        const parsed = JSON.parse(raw) as StoredAuth;
        if (parsed?.name) setAuth(parsed);
      }
    } catch {
      setAuth(null);
    } finally {
      setIsReady(true);
    }
  }, []);

  if (!isReady) {
    return (
      <main>
        <p className="subtitle">Carregando...</p>
      </main>
    );
  }

  if (!auth) {
    return (
      <main className="auth-required-page">
        <section className="auth-required-card">
          <h1 className="auth-required-title">Minhas series</h1>
          <p className="auth-required-text">Voce precisa estar logado para visualizar os detalhes da sua lista.</p>
          <Link href="/login" className="auth-required-button">
            Entrar
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="header">
        <h1>Minhas series</h1>
      </header>
      <p className="subtitle">Bem-vindo, {auth.name}. Aqui vai ficar sua lista pessoal com detalhes.</p>
    </main>
  );
}
