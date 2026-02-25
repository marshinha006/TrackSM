"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../lib/api-base-url";

type StoredAuth = {
  id?: number;
  name?: string;
  email?: string;
};

type WatchedItem = {
  tmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt?: string;
};

type TvSummary = {
  id: number;
  name: string;
  posterUrl: string | null;
};

type SeriesEpisode = {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string | null;
  stillUrl: string | null;
  overview: string;
};

type UpcomingEpisode = {
  seriesId: number;
  seriesName: string;
  seriesPosterUrl: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string;
  airDate: string;
  stillUrl: string | null;
  overview: string;
};

const API_BASE_URL = getApiBaseUrl();

function getMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

function toDateKey(input: string | null | undefined): string | null {
  if (!input) return null;
  const direct = input.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function toMonthDate(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function formatFullDate(dateKey: string): string {
  const parsed = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Data indisponivel";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(parsed);
}

export default function CalendarioPage() {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statsMonth, setStatsMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [upcomingEpisodes, setUpcomingEpisodes] = useState<UpcomingEpisode[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tracksm_auth");
      if (raw) {
        const parsed = JSON.parse(raw) as StoredAuth;
        if (parsed?.id && parsed?.name) setAuth(parsed);
      }
    } catch {
      setAuth(null);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!auth?.id) {
      setUpcomingEpisodes([]);
      return;
    }
    const userId = auth.id;

    async function loadUpcomingEpisodes() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const watchedTvResponse = await fetch(`${API_BASE_URL}/api/user/watched?userId=${userId}&mediaType=tv`);
        if (!watchedTvResponse.ok) {
          throw new Error("Nao foi possivel carregar as series da sua lista.");
        }

        const watchedTvItems = (await watchedTvResponse.json()) as WatchedItem[];
        const tvWatchedEpisodes = watchedTvItems.filter((item) => item.seasonNumber > 0 && item.episodeNumber > 0);
        if (!tvWatchedEpisodes.length) {
          setUpcomingEpisodes([]);
          return;
        }

        const uniqueByEpisode = new Map<string, WatchedItem>();
        for (const item of tvWatchedEpisodes) {
          const key = `${item.tmdbId}:${item.seasonNumber}:${item.episodeNumber}`;
          uniqueByEpisode.set(key, item);
        }
        const deduped = Array.from(uniqueByEpisode.values());

        const seriesIds = Array.from(new Set(deduped.map((item) => item.tmdbId)));
        const summaries: TvSummary[] = [];
        const idChunks = chunkArray(seriesIds, 40);
        for (const idsChunk of idChunks) {
          const summariesResponse = await fetch(`/api/tmdb/tv-summaries?ids=${idsChunk.join(",")}`);
          if (!summariesResponse.ok) {
            throw new Error("Nao foi possivel carregar os detalhes das series.");
          }
          const chunkItems = (await summariesResponse.json()) as TvSummary[];
          summaries.push(...chunkItems);
        }

        const summaryById = new Map<number, TvSummary>(summaries.map((summary) => [summary.id, summary]));
        const today = getTodayValue();

        const upcomingBySeries = await Promise.all(
          seriesIds.map(async (seriesId) => {
            const episodesResponse = await fetch(`/api/tmdb/tv-episodes?id=${seriesId}`);
            if (!episodesResponse.ok) return [] as UpcomingEpisode[];

            const episodes = (await episodesResponse.json()) as SeriesEpisode[];
            const summary = summaryById.get(seriesId);

            return episodes.flatMap((episode) => {
              const dateKey = toDateKey(episode.airDate);
              if (!dateKey) return [];

              return [
                {
                  seriesId,
                  seriesName: summary?.name ?? `Serie ${seriesId}`,
                  seriesPosterUrl: summary?.posterUrl ?? null,
                  seasonNumber: episode.seasonNumber,
                  episodeNumber: episode.episodeNumber,
                  episodeName: episode.name,
                  airDate: dateKey,
                  stillUrl: episode.stillUrl,
                  overview: episode.overview,
                },
              ];
            });
          }),
        );

        const flattened = upcomingBySeries
          .flat()
          .sort((a, b) =>
            a.airDate.localeCompare(b.airDate) ||
            a.seriesName.localeCompare(b.seriesName, "pt-BR", { sensitivity: "base" }) ||
            a.seasonNumber - b.seasonNumber ||
            a.episodeNumber - b.episodeNumber,
          );

        setUpcomingEpisodes(flattened);

        if (flattened.length > 0) {
          const nextEpisode = flattened.find((episode) => episode.airDate >= today);
          const referenceEpisode = nextEpisode ?? flattened[flattened.length - 1];
          const referenceDate = toMonthDate(referenceEpisode.airDate);
          const now = new Date();
          const hasCurrentMonthEpisodes = flattened.some(
            (episode) =>
              toMonthDate(episode.airDate).getFullYear() === now.getFullYear() &&
              toMonthDate(episode.airDate).getMonth() === now.getMonth(),
          );

          if (!hasCurrentMonthEpisodes) {
            setStatsMonth(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1));
          }
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Falha ao carregar calendario.");
        setUpcomingEpisodes([]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadUpcomingEpisodes();
  }, [auth?.id]);

  const episodesByDay = useMemo(() => {
    const map = new Map<string, UpcomingEpisode[]>();
    for (const episode of upcomingEpisodes) {
      const current = map.get(episode.airDate) ?? [];
      current.push(episode);
      map.set(episode.airDate, current);
    }

    for (const [key, items] of map.entries()) {
      items.sort(
        (a, b) =>
          a.seriesName.localeCompare(b.seriesName, "pt-BR", { sensitivity: "base" }) ||
          a.seasonNumber - b.seasonNumber ||
          a.episodeNumber - b.episodeNumber,
      );
      map.set(key, items);
    }

    return map;
  }, [upcomingEpisodes]);

  const statsDays = useMemo(() => {
    const firstOfMonth = new Date(statsMonth.getFullYear(), statsMonth.getMonth(), 1);
    const firstWeekday = firstOfMonth.getDay();
    const firstCellDate = new Date(firstOfMonth);
    firstCellDate.setDate(firstOfMonth.getDate() - firstWeekday);

    return Array.from({ length: 42 }, (_, index) => {
      const dayDate = new Date(firstCellDate);
      dayDate.setDate(firstCellDate.getDate() + index);
      const dayKey = `${dayDate.getFullYear()}-${`${dayDate.getMonth() + 1}`.padStart(2, "0")}-${`${dayDate.getDate()}`.padStart(2, "0")}`;
      const items = episodesByDay.get(dayKey) ?? [];

      return {
        date: dayDate,
        key: dayKey,
        isCurrentMonth: dayDate.getMonth() === statsMonth.getMonth(),
        episodes: items,
      };
    });
  }, [episodesByDay, statsMonth]);

  const monthEpisodes = useMemo(
    () =>
      statsDays
        .filter((day) => day.isCurrentMonth)
        .flatMap((day) => day.episodes)
        .sort((a, b) => a.airDate.localeCompare(b.airDate) || a.seriesName.localeCompare(b.seriesName, "pt-BR", { sensitivity: "base" })),
    [statsDays],
  );

  const episodesFromViewedDate = useMemo(() => {
    const todayKey = getTodayValue();
    const viewedMonthStartKey = `${statsMonth.getFullYear()}-${`${statsMonth.getMonth() + 1}`.padStart(2, "0")}-01`;
    const referenceDateKey = viewedMonthStartKey > todayKey ? viewedMonthStartKey : todayKey;
    return upcomingEpisodes.filter((episode) => episode.airDate >= referenceDateKey);
  }, [upcomingEpisodes, statsMonth]);

  const monthSeriesCount = useMemo(() => new Set(monthEpisodes.map((episode) => episode.seriesId)).size, [monthEpisodes]);

  if (!isReady) {
    return (
      <main>
        <header className="header">
          <h1>Calendario</h1>
        </header>
        <p className="subtitle">Carregando...</p>
      </main>
    );
  }

  return (
    <main>
      <header className="header">
        <h1>Calendario</h1>
      </header>
      <p className="subtitle">Calendario de lancamentos das series da sua lista.</p>

      {!auth?.id ? <p className="subtitle">Faca login para ver o calendario de lancamentos.</p> : null}
      {auth?.id && isLoading ? <p className="subtitle">Carregando calendario...</p> : null}
      {auth?.id && !isLoading && errorMessage ? <p className="subtitle">{errorMessage}</p> : null}

      {auth?.id && !isLoading && !errorMessage && !upcomingEpisodes.length ? (
        <p className="subtitle">Nao encontramos lancamentos para as series da sua lista.</p>
      ) : null}

      {auth?.id && !isLoading && !errorMessage && upcomingEpisodes.length ? (
        <section className="calendar-shell" aria-label="Calendario de proximos episodios">
          <div className="calendar-overview">
            <article className="calendar-overview-card">
              <p className="calendar-overview-label">Episodios futuros</p>
              <p className="calendar-overview-value">{episodesFromViewedDate.length}</p>
            </article>
            <article className="calendar-overview-card">
              <p className="calendar-overview-label">Neste mes</p>
              <p className="calendar-overview-value">{monthEpisodes.length}</p>
            </article>
            <article className="calendar-overview-card">
              <p className="calendar-overview-label">Series no mes</p>
              <p className="calendar-overview-value">{monthSeriesCount}</p>
            </article>
          </div>

          <section className="my-series-stats-board calendar-board" aria-label="Calendario mensal de episodios">
            <header className="my-series-stats-header">
              <button
                type="button"
                className="my-series-stats-nav"
                onClick={() => setStatsMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                aria-label="Mes anterior"
              >
                {"<"}
              </button>
              <h2 className="my-series-stats-title">{getMonthLabel(statsMonth)}</h2>
              <button
                type="button"
                className="my-series-stats-nav"
                onClick={() => setStatsMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                aria-label="Proximo mes"
              >
                {">"}
              </button>
            </header>

            <div className="my-series-stats-weekdays">
              <span>Dom</span>
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sab</span>
            </div>

            <div className="my-series-stats-grid">
              {statsDays.map((day) => (
                <article key={day.key} className={`my-series-stats-day${day.isCurrentMonth ? "" : " is-outside"}`}>
                  <span className="my-series-stats-day-number">{day.date.getDate()}</span>

                  {day.episodes.length > 0 ? (
                    <div className="calendar-day-content">
                      <div className="my-series-stats-avatars">
                        {day.episodes.slice(0, 3).map((episode, index) => (
                          <Link
                            key={`${day.key}:${episode.seriesId}:${episode.seasonNumber}:${episode.episodeNumber}`}
                            href={`/detalhe/serie/${episode.seriesId}`}
                            className="my-series-stats-avatar"
                            style={{ transform: `translateX(${index * -9}px)`, zIndex: 10 - index }}
                            title={`${episode.seriesName} - T${episode.seasonNumber}E${episode.episodeNumber}`}
                            aria-label={`${episode.seriesName} - T${episode.seasonNumber}E${episode.episodeNumber}`}
                          >
                            {episode.seriesPosterUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={episode.seriesPosterUrl} alt="" loading="lazy" />
                            ) : (
                              <span className="my-series-stats-avatar-empty" />
                            )}
                          </Link>
                        ))}
                      </div>
                      <p className="calendar-day-count">{day.episodes.length} lancamento(s)</p>
                      <ul className="calendar-day-list">
                        {day.episodes.slice(0, 2).map((episode) => (
                          <li key={`${day.key}:line:${episode.seriesId}:${episode.seasonNumber}:${episode.episodeNumber}`}>
                            <Link href={`/detalhe/serie/${episode.seriesId}`} className="calendar-day-item-link">
                              {`T${episode.seasonNumber}E${episode.episodeNumber.toString().padStart(2, "0")} ${episode.seriesName}`}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {day.episodes.length > 2 ? <p className="calendar-day-more">+{day.episodes.length - 2} episodio(s)</p> : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="calendar-upcoming" aria-label="Lista de proximos episodios do mes">
            <h2 className="calendar-upcoming-title">Lancamentos de {getMonthLabel(statsMonth)}</h2>
            {!monthEpisodes.length ? <p className="subtitle">Nenhum episodio previsto neste mes.</p> : null}
            {monthEpisodes.length ? (
              <ul className="calendar-upcoming-list">
                {monthEpisodes.map((episode) => (
                  <li key={`${episode.airDate}:${episode.seriesId}:${episode.seasonNumber}:${episode.episodeNumber}`} className="calendar-upcoming-item">
                    <span className="calendar-upcoming-date">{formatFullDate(episode.airDate)}</span>
                    <Link href={`/detalhe/serie/${episode.seriesId}`} className="calendar-upcoming-link">
                      {episode.seriesName} - T{episode.seasonNumber}E{episode.episodeNumber.toString().padStart(2, "0")} - {episode.episodeName}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </section>
      ) : null}
    </main>
  );
}
