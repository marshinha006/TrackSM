"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getApiBaseUrl } from "../lib/api-base-url";

type StatusState = {
  type: "idle" | "error";
  message: string;
};

const API_BASE_URL = getApiBaseUrl();

export default function LoginForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<StatusState>({ type: "idle", message: "" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (!email || !password) {
      setStatus({ type: "error", message: "Informe email e senha." });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json().catch(() => ({}))) as { id?: number; name?: string; email?: string; error?: string };
      if (!response.ok || !payload.name || !payload.email) {
        setStatus({ type: "error", message: payload.error || "Nao foi possivel entrar." });
        return;
      }

      localStorage.setItem(
        "tracksm_auth",
        JSON.stringify({
          id: payload.id,
          name: payload.name,
          email: payload.email,
          loggedAt: new Date().toISOString(),
        }),
      );
      window.dispatchEvent(new Event("tracksm-auth-updated"));
      router.push("/");
      router.refresh();
    } catch {
      setStatus({ type: "error", message: "Erro de conexao com o servidor." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form className="login-form" onSubmit={handleSubmit}>
        <label className="login-label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" placeholder="email@email.com" autoComplete="email" required />

        <label className="login-label" htmlFor="password">
          Senha
        </label>
        <input id="password" name="password" type="password" placeholder="Sua senha" autoComplete="current-password" required />

        <div className="login-row">
          <label className="login-check">
            <input className="login-check-input" type="checkbox" name="remember" />
            Manter conectado
          </label>
          <Link href="/" className="login-forgot">
            Esqueci minha senha
          </Link>
        </div>

        <button type="submit" className="login-submit" disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {status.type === "error" ? <p className="auth-feedback is-error">{status.message}</p> : null}
    </>
  );
}
