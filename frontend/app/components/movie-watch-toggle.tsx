"use client";

import { useEffect, useState } from "react";

type StoredAuth = {
  id?: number;
};

type WatchedItem = {
  seasonNumber: number;
  episodeNumber: number;
};

type MovieWatchToggleProps = {
  tmdbId: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function MovieWatchToggle({ tmdbId }: MovieWatchToggleProps) {
  const [userId, setUserId] = useState<number | null>(null);
  const [movieWatched, setMovieWatched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tracksm_auth");
      if (!raw) {
        setUserId(null);
        setMovieWatched(false);
        return;
      }
      const parsed = JSON.parse(raw) as StoredAuth;
      setUserId(typeof parsed.id === "number" ? parsed.id : null);
    } catch {
      setUserId(null);
      setMovieWatched(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setMovieWatched(false);
      return;
    }

    async function loadWatched() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/user/watched?userId=${userId}&mediaType=movie&tmdbId=${tmdbId}`,
        );
        if (!response.ok) return;
        const data = (await response.json()) as WatchedItem[];
        const watched = data.some((item) => item.seasonNumber === 0 && item.episodeNumber === 0);
        setMovieWatched(watched);
      } catch {
        // noop
      }
    }

    void loadWatched();
  }, [userId, tmdbId]);

  async function toggleMovieWatched() {
    if (!userId || isLoading) return;
    setIsLoading(true);
    try {
      const method = movieWatched ? "DELETE" : "POST";
      const response = await fetch(`${API_BASE_URL}/api/user/watched`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          mediaType: "movie",
          tmdbId: Number(tmdbId),
          seasonNumber: 0,
          episodeNumber: 0,
        }),
      });
      if (!response.ok) return;
      setMovieWatched((prev) => !prev);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="detail-side-watch">
      <button
        type="button"
        className={`watched-toggle${movieWatched ? " is-watched" : ""}`}
        onClick={() => void toggleMovieWatched()}
        disabled={!userId || isLoading}
      >
        {movieWatched ? "Visto" : "Ver"}
      </button>
      {!userId ? <span className="watched-help">Faca login para marcar.</span> : null}
    </div>
  );
}
