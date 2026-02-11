"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type StatusState = {
  type: "idle" | "success" | "error";
  message: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function CadastroPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<StatusState>({ type: "idle", message: "" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (!name || !email || !password) {
      setStatus({ type: "error", message: "Preencha nome, email e senha." });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({ type: "error", message: "As senhas nao conferem." });
      return;
    }

    if (password.length < 6) {
      setStatus({ type: "error", message: "A senha precisa ter pelo menos 6 caracteres." });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const payload = (await response.json().catch(() => ({}))) as { id?: number; name?: string; email?: string; error?: string };

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error || "Nao foi possivel criar a conta." });
        return;
      }

      setStatus({ type: "success", message: "Conta criada com sucesso. Agora voce pode entrar." });
      localStorage.setItem(
        "tracksm_auth",
        JSON.stringify({
          id: payload.id,
          name: payload.name || name,
          email: payload.email || email,
          loggedAt: new Date().toISOString(),
        }),
      );
      window.dispatchEvent(new Event("tracksm-auth-updated"));
      form.reset();
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 900);
    } catch {
      setStatus({ type: "error", message: "Erro de conexao com o servidor." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Criacao de conta">
        <p className="login-kicker">Cadastro</p>
        <h1 className="login-title">Criar conta no TrackSM</h1>
        <p className="login-subtitle">Registre-se para salvar listas e acompanhar seu progresso.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label" htmlFor="name">
            Nome
          </label>
          <input id="name" name="name" type="text" placeholder="Seu nome" autoComplete="name" required />

          <label className="login-label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" placeholder="voce@email.com" autoComplete="email" required />

          <label className="login-label" htmlFor="password">
            Senha
          </label>
          <input id="password" name="password" type="password" placeholder="Sua senha" autoComplete="new-password" required />

          <label className="login-label" htmlFor="confirmPassword">
            Confirmar senha
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Repita sua senha"
            autoComplete="new-password"
            required
          />

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? "Criando..." : "Criar conta"}
          </button>
        </form>

        {status.type !== "idle" ? (
          <p className={`auth-feedback ${status.type === "success" ? "is-success" : "is-error"}`}>{status.message}</p>
        ) : null}

        <p className="login-footer">
          Ja tem conta?{" "}
          <Link href="/login" className="login-footer-link">
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
