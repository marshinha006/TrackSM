"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "../lib/api-base-url";

type DetailWishlistToggleProps = {
  tmdbId: string;
  mediaType: "movie" | "tv";
};

type StoredAuth = {
  id?: number;
};

type WishlistItem = {
  tmdbId: number;
};

const API_BASE_URL = getApiBaseUrl();
const WISHLIST_STORAGE_KEY = "tracksm_wishlist";

function getFallbackWishlistIds(userId: number, mediaType: "movie" | "tv"): number[] {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, number[]>;
    const key = `${userId}:${mediaType}`;
    const ids = parsed[key] ?? [];
    return ids.filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function setFallbackWishlistIds(userId: number, mediaType: "movie" | "tv", ids: number[]) {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number[]>) : {};
    const key = `${userId}:${mediaType}`;
    parsed[key] = Array.from(new Set(ids.filter((value) => Number.isInteger(value) && value > 0)));
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // noop
  }
}

export default function DetailWishlistToggle({ tmdbId, mediaType }: DetailWishlistToggleProps) {
  const [userId, setUserId] = useState<number | null>(null);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tracksm_auth");
      if (!raw) {
        setUserId(null);
        setIsInWishlist(false);
        return;
      }
      const parsed = JSON.parse(raw) as StoredAuth;
      setUserId(typeof parsed.id === "number" ? parsed.id : null);
    } catch {
      setUserId(null);
      setIsInWishlist(false);
    }
  }, []);

  useEffect(() => {
    const resolvedUserId = userId;
    if (resolvedUserId === null) {
      setIsInWishlist(false);
      return;
    }
    const uid = Number(resolvedUserId);

    let cancelled = false;

    async function loadWishlist() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/user/wishlist?userId=${uid}&mediaType=${mediaType}&tmdbId=${tmdbId}`,
        );
        if (!response.ok) {
          if (response.status === 404) {
            if (!cancelled) {
              const ids = getFallbackWishlistIds(uid, mediaType);
              setIsInWishlist(ids.includes(Number(tmdbId)));
            }
            return;
          }
          if (!cancelled) setIsInWishlist(false);
          return;
        }
        const data = (await response.json()) as WishlistItem[];
        if (!cancelled) {
          setIsInWishlist(data.some((item) => item.tmdbId === Number(tmdbId)));
        }
      } catch {
        if (!cancelled) setIsInWishlist(false);
      }
    }

    void loadWishlist();

    return () => {
      cancelled = true;
    };
  }, [userId, mediaType, tmdbId]);

  async function toggleWishlist() {
    const resolvedUserId = userId;
    if (resolvedUserId === null || isLoading) return;
    const uid = Number(resolvedUserId);
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/wishlist`, {
        method: isInWishlist ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: uid,
          mediaType,
          tmdbId: Number(tmdbId),
        }),
      });
      if (response.ok) {
        setIsInWishlist((prev) => !prev);
        window.dispatchEvent(new Event("tracksm-wishlist-updated"));
        return;
      }

      if (response.status === 404) {
        const currentIds = getFallbackWishlistIds(uid, mediaType);
        const nextIds = isInWishlist
          ? currentIds.filter((id) => id !== Number(tmdbId))
          : [...currentIds, Number(tmdbId)];
        setFallbackWishlistIds(uid, mediaType, nextIds);
        setIsInWishlist((prev) => !prev);
        window.dispatchEvent(new Event("tracksm-wishlist-updated"));
      }
    } catch {
      const currentIds = getFallbackWishlistIds(uid, mediaType);
      const nextIds = isInWishlist
        ? currentIds.filter((id) => id !== Number(tmdbId))
        : [...currentIds, Number(tmdbId)];
      setFallbackWishlistIds(uid, mediaType, nextIds);
      setIsInWishlist((prev) => !prev);
      window.dispatchEvent(new Event("tracksm-wishlist-updated"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="detail-wishlist">
      <button
        type="button"
        className={`detail-wishlist-button${isInWishlist ? " is-added" : ""}`}
        onClick={() => void toggleWishlist()}
        disabled={!userId || isLoading}
      >
        {isInWishlist ? "Remover" : "Adicionar a lista"}
      </button>
      {!userId ? <p className="detail-wishlist-help">Faca login para adicionar a lista.</p> : null}
    </div>
  );
}
