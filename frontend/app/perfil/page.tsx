"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../lib/api-base-url";

type StoredAuth = {
  id?: number;
  name?: string;
  email?: string;
  username?: string;
  photoUrl?: string;
};

type StatusState = {
  type: "idle" | "success" | "error";
  message: string;
};

const API_BASE_URL = getApiBaseUrl();
const DEFAULT_AVATAR = "/default-avatar.svg";

function usernameFromName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/^[._]+|[._]+$/g, "");

  if (sanitized.length >= 3) return sanitized.slice(0, 30);
  return "usuario";
}

export default function PerfilPage() {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<StatusState>({ type: "idle", message: "" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tracksm_auth");
      if (!raw) {
        setAuth(null);
        return;
      }
      const parsed = JSON.parse(raw) as StoredAuth;
      if (!parsed?.id || !parsed?.name || !parsed?.email) {
        setAuth(null);
        return;
      }

      setAuth(parsed);
      setName(parsed.name);
      setUsername((parsed.username || usernameFromName(parsed.name)).replace(/^@+/, ""));
      setPhotoUrl(parsed.photoUrl || "");
    } catch {
      setAuth(null);
    }
  }, []);

  const avatarPreview = useMemo(() => photoUrl.trim() || DEFAULT_AVATAR, [photoUrl]);

  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus({ type: "error", message: "Selecione um arquivo de imagem valido." });
      return;
    }
    if (file.size > 2_500_000) {
      setStatus({ type: "error", message: "A imagem deve ter no maximo 2.5 MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        setStatus({ type: "error", message: "Nao foi possivel ler a imagem." });
        return;
      }
      setPhotoUrl(result);
      setStatus({ type: "idle", message: "" });
    };
    reader.onerror = () => setStatus({ type: "error", message: "Falha ao carregar imagem." });
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!auth?.id || !auth?.email) {
      setStatus({ type: "error", message: "Faca login para editar seu perfil." });
      return;
    }

    const nextName = name.trim();
    const nextUsername = username.trim().replace(/^@+/, "").toLowerCase();
    const nextPhotoUrl = photoUrl.trim();

    if (!nextName) {
      setStatus({ type: "error", message: "Informe seu nome." });
      return;
    }
    if (!nextUsername) {
      setStatus({ type: "error", message: "Informe um @username." });
      return;
    }

    setIsSaving(true);
    setStatus({ type: "idle", message: "" });
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.id,
          name: nextName,
          username: nextUsername,
          photoUrl: nextPhotoUrl,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        id?: number;
        name?: string;
        email?: string;
        username?: string;
        photoUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.name || !payload.email) {
        setStatus({ type: "error", message: payload.error || "Nao foi possivel atualizar o perfil." });
        return;
      }

      const nextAuth: StoredAuth = {
        id: payload.id ?? auth.id,
        email: payload.email,
        name: payload.name,
        username: payload.username || nextUsername,
        photoUrl: payload.photoUrl || "",
      };
      localStorage.setItem("tracksm_auth", JSON.stringify(nextAuth));
      window.dispatchEvent(new Event("tracksm-auth-updated"));

      setAuth(nextAuth);
      setName(nextAuth.name || "");
      setUsername((nextAuth.username || "").replace(/^@+/, ""));
      setPhotoUrl(nextAuth.photoUrl || "");
      setStatus({ type: "success", message: "Perfil atualizado com sucesso." });
    } catch {
      setStatus({ type: "error", message: "Erro de conexao com o servidor." });
    } finally {
      setIsSaving(false);
    }
  }

  if (!auth) {
    return (
      <main className="auth-required-page">
        <section className="auth-required-card">
          <h1 className="auth-required-title">Meu perfil</h1>
          <p className="auth-required-text">Voce precisa estar logado para editar seu perfil.</p>
          <Link href="/login" className="auth-required-button">
            Entrar
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <header className="header">
        <h1>Meu perfil</h1>
      </header>
      <section className="profile-card">
        <div className="profile-avatar-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="profile-avatar-preview" src={avatarPreview} alt={`Foto de ${name || "usuario"}`} />
          <label className="profile-file-label">
            Enviar foto
            <input type="file" accept="image/*" onChange={handlePhotoUpload} />
          </label>
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <label htmlFor="profile-name">Nome</label>
          <input
            id="profile-name"
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
          />

          <label htmlFor="profile-username">Username (@)</label>
          <div className="profile-username-input-wrap">
            <span>@</span>
            <input
              id="profile-username"
              name="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value.replace(/^@+/, ""))}
              maxLength={30}
              required
            />
          </div>

          <label htmlFor="profile-photo-url">Foto (URL ou upload)</label>
          <input
            id="profile-photo-url"
            name="photoUrl"
            type="url"
            value={photoUrl}
            onChange={(event) => setPhotoUrl(event.target.value)}
            placeholder="https://..."
          />

          <button type="submit" disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar alteracoes"}
          </button>
        </form>
      </section>

      {status.type !== "idle" ? (
        <p className={`auth-feedback ${status.type === "success" ? "is-success" : "is-error"}`}>{status.message}</p>
      ) : null}
    </main>
  );
}
