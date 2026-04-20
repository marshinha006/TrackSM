"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../lib/api-base-url";

type StoredAuth = {
  id?: number;
};

type WishlistItem = {
  tmdbId: number;
};

type TvSummary = {
  id: number;
  name: string;
  posterUrl: string | null;
};

type MovieSummary = {
  id: number;
  title: string;
  posterUrl: string | null;
};

type ActiveTab = "tv" | "movie";

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

export default function MinhaListaPage() {
  const [userId, setUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("tv");
  const [isLoading, setIsLoading] = useState(false);
  const [seriesItems, setSeriesItems] = useState<TvSummary[]>([]);
  const [movieItems, setMovieItems] = useState<MovieSummary[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tracksm_auth");
      if (!raw) {
        setUserId(null);
        return;
      }
      const parsed = JSON.parse(raw) as StoredAuth;
      setUserId(typeof parsed.id === "number" && parsed.id > 0 ? parsed.id : null);
    } catch {
      setUserId(null);
    }
  }, []);

  useEffect(() => {
    const resolvedUserId = userId;
    if (resolvedUserId === null) {
      setSeriesItems([]);
      setMovieItems([]);
      return;
    }
    const uid = Number(resolvedUserId);

    let cancelled = false;

    async function loadWishlist() {
      setIsLoading(true);
      try {
        const [tvWishRes, movieWishRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/user/wishlist?userId=${uid}&mediaType=tv`),
          fetch(`${API_BASE_URL}/api/user/wishlist?userId=${uid}&mediaType=movie`),
        ]);

        const tvIds = tvWishRes.ok
          ? ((await tvWishRes.json()) as WishlistItem[])
              .map((item) => item.tmdbId)
              .filter((value) => Number.isInteger(value) && value > 0)
          : tvWishRes.status === 404
            ? getFallbackWishlistIds(uid, "tv")
            : [];

        const movieIds = movieWishRes.ok
          ? ((await movieWishRes.json()) as WishlistItem[])
              .map((item) => item.tmdbId)
              .filter((value) => Number.isInteger(value) && value > 0)
          : movieWishRes.status === 404
            ? getFallbackWishlistIds(uid, "movie")
            : [];

        const [tvSummaryRes, movieSummaryRes] = await Promise.all([
          tvIds.length ? fetch(`/api/tmdb/tv-summaries?ids=${tvIds.join(",")}`) : Promise.resolve(null),
          movieIds.length ? fetch(`/api/tmdb/movie-summaries?ids=${movieIds.join(",")}`) : Promise.resolve(null),
        ]);

        const tvItems = tvSummaryRes?.ok ? ((await tvSummaryRes.json()) as TvSummary[]) : [];
        const movies = movieSummaryRes?.ok ? ((await movieSummaryRes.json()) as MovieSummary[]) : [];

        if (cancelled) return;
        setSeriesItems(tvItems);
        setMovieItems(movies);
      } catch {
        if (cancelled) return;
        const fallbackTvIds = getFallbackWishlistIds(uid, "tv");
        const fallbackMovieIds = getFallbackWishlistIds(uid, "movie");
        try {
          const [tvSummaryRes, movieSummaryRes] = await Promise.all([
            fallbackTvIds.length ? fetch(`/api/tmdb/tv-summaries?ids=${fallbackTvIds.join(",")}`) : Promise.resolve(null),
            fallbackMovieIds.length ? fetch(`/api/tmdb/movie-summaries?ids=${fallbackMovieIds.join(",")}`) : Promise.resolve(null),
          ]);
          const tvItems = tvSummaryRes?.ok ? ((await tvSummaryRes.json()) as TvSummary[]) : [];
          const movies = movieSummaryRes?.ok ? ((await movieSummaryRes.json()) as MovieSummary[]) : [];
          if (cancelled) return;
          setSeriesItems(tvItems);
          setMovieItems(movies);
        } catch {
          if (cancelled) return;
          setSeriesItems([]);
          setMovieItems([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadWishlist();

    function handleWishlistUpdate() {
      void loadWishlist();
    }

    window.addEventListener("tracksm-wishlist-updated", handleWishlistUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("tracksm-wishlist-updated", handleWishlistUpdate);
    };
  }, [userId]);

  const currentItems = useMemo(() => (activeTab === "tv" ? seriesItems : movieItems), [activeTab, seriesItems, movieItems]);

  if (!userId) {
    return (
      <main className="auth-required-page">
        <section className="auth-required-card">
          <h1 className="auth-required-title">Minha Lista</h1>
          <p className="auth-required-text">Voce precisa estar logado para visualizar sua lista de desejos.</p>
          <Link href="/login" className="auth-required-button">
            Fazer login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="my-list-page">
      <header className="my-list-header">
        <h1>Minha Lista</h1>
        <p className="subtitle">Titulos que voce salvou para assistir depois.</p>
      </header>

      <section className="my-list-board" aria-label="Lista de desejos">
        <div className="my-list-tabs">
          <button
            type="button"
            className={`my-list-tab${activeTab === "tv" ? " is-active" : ""}`}
            onClick={() => setActiveTab("tv")}
          >
            Series ({seriesItems.length})
          </button>
          <button
            type="button"
            className={`my-list-tab${activeTab === "movie" ? " is-active" : ""}`}
            onClick={() => setActiveTab("movie")}
          >
            Filmes ({movieItems.length})
          </button>
        </div>

        {isLoading ? <p className="my-list-empty">Carregando sua lista...</p> : null}

        {!isLoading && !currentItems.length ? (
          <p className="my-list-empty">{activeTab === "tv" ? "Nenhuma serie salva ainda." : "Nenhum filme salvo ainda."}</p>
        ) : null}

        {!isLoading && currentItems.length ? (
          <div className="my-list-grid">
            {currentItems.map((item) => {
              const href =
                activeTab === "tv"
                  ? `/detalhe/serie/${item.id}`
                  : `/detalhe/filme/${item.id}`;
              const title = activeTab === "tv" ? (item as TvSummary).name : (item as MovieSummary).title;

              return (
                <Link key={`${activeTab}-${item.id}`} href={href} className="my-list-card-link" aria-label={`Abrir ${title}`}>
                  <article className="my-list-card">
                    {item.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="my-list-card-image" src={item.posterUrl} alt={title} loading="lazy" />
                    ) : (
                      <div className="my-list-card-image my-list-card-image-empty" />
                    )}
                    <p className="my-list-card-title">{title}</p>
                  </article>
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
