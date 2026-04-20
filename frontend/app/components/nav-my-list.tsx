"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type StoredAuth = {
  id?: number;
};

export default function NavMyList() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  function syncAuth() {
    try {
      const raw = localStorage.getItem("tracksm_auth");
      if (!raw) {
        setIsLoggedIn(false);
        return;
      }
      const parsed = JSON.parse(raw) as StoredAuth;
      setIsLoggedIn(typeof parsed.id === "number" && parsed.id > 0);
    } catch {
      setIsLoggedIn(false);
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

  if (!isLoggedIn) return null;

  return (
    <Link href="/minha-lista" className="nav-link">
      Minha Lista
    </Link>
  );
}
