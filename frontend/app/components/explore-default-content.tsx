"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getApiBaseUrl } from "../lib/api-base-url";

type StoredAuth = {
  id?: number;
};

type WatchedItem = {
  tmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
};

type TmdbItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  vote_average: number;
};

const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";
const API_BASE_URL = getApiBaseUrl();

function uniqueIds(items: WatchedItem[], mediaType: "movie" | "tv"): number[] {
  const filtered = items.filter((item) =>
    mediaType === "movie" ? item.seasonNumber === 0 && item.episodeNumber === 0 : item.seasonNumber > 0 && item.episodeNumber > 0,
  );

  const ids: number[] = [];
  const seen = new Set<number>();
  for (const item of filtered) {
    if (seen.has(item.tmdbId)) continue;
    seen.add(item.tmdbId);
    ids.push(item.tmdbId);
  }
  return ids.slice(0, 8);
}

function renderCard(item: TmdbItem, mediaType: "movie" | "tv") {
  const title = item.title ?? item.name ?? "Sem titulo";
  const appMediaType = mediaType === "movie" ? "filme" : "serie";
  const fillPercent = Math.max(0, Math.min(100, item.vote_average * 10));

  return (
    <Link className="card-link" href={`/detalhe/${appMediaType}/${item.id}`} key={`${mediaType}-${item.id}`}>
      <article className="card">
        {item.poster_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="poster" src={`${TMDB_IMAGE_URL}${item.poster_path}`} alt={`Poster de ${title}`} />
        ) : (
          <div className="poster" />
        )}
        <div className="rating-chip" aria-label={`Nota ${item.vote_average.toFixed(1)} de 10`}>
          <span className="star-meter" aria-hidden="true">
            {"\u2605"}
            <span className="star-meter-fill" style={{ width: `${fillPercent}%` }}>
              {"\u2605"}
            </span>
          </span>
          Nota {item.vote_average.toFixed(1)}
        </div>
      </article>
    </Link>
  );
}

export default function ExploreDefaultContent() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [movieRecommendations, setMovieRecommendations] = useState<TmdbItem[]>([]);
  const [tvRecommendations, setTvRecommendations] = useState<TmdbItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadRecommendations() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const raw = localStorage.getItem("tracksm_auth");
        const parsed = raw ? (JSON.parse(raw) as StoredAuth) : null;
        const userId = parsed?.id;

        if (!userId) {
          if (!isMounted) return;
          setMovieRecommendations([]);
          setTvRecommendations([]);
          return;
        }

        const watchedResponse = await fetch(`${API_BASE_URL}/api/user/watched?userId=${userId}&mediaType=tv`);
        const watchedMovieResponse = await fetch(`${API_BASE_URL}/api/user/watched?userId=${userId}&mediaType=movie`);

        if (!watchedResponse.ok || !watchedMovieResponse.ok) {
          throw new Error("Nao foi possivel carregar seu historico para recomendações.");
        }

        const watchedTvItems = (await watchedResponse.json()) as WatchedItem[];
        const watchedMovieItems = (await watchedMovieResponse.json()) as WatchedItem[];
        const watchedTvIds = new Set<number>(watchedTvItems.filter((item) => item.seasonNumber > 0).map((item) => item.tmdbId));
        const watchedMovieIds = new Set<number>(
          watchedMovieItems.filter((item) => item.seasonNumber === 0 && item.episodeNumber === 0).map((item) => item.tmdbId),
        );

        const tvIds = uniqueIds(watchedTvItems, "tv");
        const movieIds = uniqueIds(watchedMovieItems, "movie");

        const [tvRecResponse, movieRecResponse] = await Promise.all([
          tvIds.length ? fetch(`/api/tmdb/recommendations?mediaType=tv&ids=${tvIds.join(",")}`) : Promise.resolve(null),
          movieIds.length ? fetch(`/api/tmdb/recommendations?mediaType=movie&ids=${movieIds.join(",")}`) : Promise.resolve(null),
        ]);

        if (tvRecResponse && !tvRecResponse.ok) throw new Error("Falha ao carregar recomendações de series.");
        if (movieRecResponse && !movieRecResponse.ok) throw new Error("Falha ao carregar recomendações de filmes.");

        const [tvItems, movieItems] = await Promise.all([
          tvRecResponse ? ((await tvRecResponse.json()) as TmdbItem[]) : Promise.resolve([] as TmdbItem[]),
          movieRecResponse ? ((await movieRecResponse.json()) as TmdbItem[]) : Promise.resolve([] as TmdbItem[]),
        ]);

        if (!isMounted) return;
        const filteredTvItems = tvItems.filter((item) => !watchedTvIds.has(item.id));
        const filteredMovieItems = movieItems.filter((item) => !watchedMovieIds.has(item.id));
        setTvRecommendations(filteredTvItems.slice(0, 20));
        setMovieRecommendations(filteredMovieItems.slice(0, 20));
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(error instanceof Error ? error.message : "Falha ao carregar recomendações.");
        setMovieRecommendations([]);
        setTvRecommendations([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsReady(true);
        }
      }
    }

    void loadRecommendations();
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isReady || isLoading) {
    return <p className="subtitle">Carregando recomendações personalizadas...</p>;
  }

  if (errorMessage) {
    return <p className="subtitle">{errorMessage}</p>;
  }

  if (!movieRecommendations.length && !tvRecommendations.length) {
    return <p className="subtitle">Assista alguns titulos para receber recomendações personalizadas.</p>;
  }

  return (
    <>
      <p className="subtitle">Recomendações baseadas no que voce assistiu.</p>

      {movieRecommendations.length ? (
        <section>
          <h2 className="section-title">Filmes recomendados para voce</h2>
          <div className="grid">{movieRecommendations.map((item) => renderCard(item, "movie"))}</div>
        </section>
      ) : null}

      {tvRecommendations.length ? (
        <section>
          <h2 className="section-title">Series recomendadas para voce</h2>
          <div className="grid">{tvRecommendations.map((item) => renderCard(item, "tv"))}</div>
        </section>
      ) : null}
    </>
  );
}

