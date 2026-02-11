"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type StoredAuth = {
  name?: string;
  email?: string;
  photoUrl?: string;
};

const DEFAULT_AVATAR = "/default-avatar.svg";

export default function NavAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  function syncAuth() {
    try {
      const raw = localStorage.getItem("tracksm_auth");
      if (!raw) {
        setAuth(null);
        return;
      }
      const parsed = JSON.parse(raw) as StoredAuth;
      if (!parsed?.name) {
        setAuth(null);
        return;
      }
      setAuth(parsed);
    } catch {
      setAuth(null);
    }
  }

  useEffect(() => {
    syncAuth();
  }, [pathname]);

  useEffect(() => {
    function handleAuthUpdate() {
      syncAuth();
    }

    window.addEventListener("tracksm-auth-updated", handleAuthUpdate);
    window.addEventListener("storage", handleAuthUpdate);
    return () => {
      window.removeEventListener("tracksm-auth-updated", handleAuthUpdate);
      window.removeEventListener("storage", handleAuthUpdate);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest(".nav-auth-user")) {
        setIsOpen(false);
      }
    }

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isOpen]);

  const firstName = useMemo(() => {
    if (!auth?.name) return "";
    return auth.name.trim().split(" ")[0];
  }, [auth]);

  if (!auth) {
    return (
      <Link href="/login" className="nav-auth-link">
        Entrar
      </Link>
    );
  }

  function handleLogout() {
    localStorage.removeItem("tracksm_auth");
    window.dispatchEvent(new Event("tracksm-auth-updated"));
    setIsOpen(false);
    setAuth(null);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="nav-auth-user">
      <span className="nav-welcome">
        <span className="nav-welcome-prefix">Bem-vindo, </span>
        <span className="nav-welcome-name">{firstName}</span>
      </span>
      <button
        type="button"
        className="nav-avatar-button"
        aria-expanded={isOpen}
        aria-label="Abrir menu de usuario"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="nav-avatar" src={auth.photoUrl || DEFAULT_AVATAR} alt={`Foto de ${auth.name}`} />
      </button>

      {isOpen ? (
        <div className="nav-user-menu" role="menu" aria-label="Menu do usuario">
          <Link className="nav-user-menu-item" href="/perfil" onClick={() => setIsOpen(false)}>
            Meu perfil
          </Link>
          <button type="button" className="nav-user-menu-item" onClick={handleLogout}>
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
