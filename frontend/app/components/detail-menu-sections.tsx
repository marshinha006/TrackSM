"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../lib/api-base-url";

type CastPerson = {
  id: number;
  name: string;
  character: string;
  profileUrl: string | null;
};

type DetailMenuSectionsProps = {
  cast: CastPerson[];
  mediaType: "movie" | "tv";
  tmdbId: string;
  seasons: SeasonPanelData[];
};

type SeasonPanelData = {
  seasonNumber: number;
  seasonName: string;
  episodeCount: number;
  episodes: {
    id: number;
    name: string;
    episodeNumber: number;
    airDate?: string;
    stillUrl: string | null;
    overview?: string;
  }[];
};

type ActiveSection = "cast" | "watch" | "seasons" | null;
type StoredAuth = {
  id?: number;
};
type WatchedItem = {
  seasonNumber: number;
  episodeNumber: number;
  watchedAt?: string;
};
type PreviousEpisodesConfirmState = {
  key: string;
  watchedAt: string;
  missingPreviousKeys: string[];
};

const API_BASE_URL = getApiBaseUrl();
const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

function getTodayValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function fromDateValue(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildCalendarDays(monthStart: Date): { date: Date; inMonth: boolean; disabled: boolean; dateValue: string }[] {
  const firstDayOfWeek = monthStart.getDay();
  const gridStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 - firstDayOfWeek, 12, 0, 0, 0);
  const today = fromDateValue(getTodayValue());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index, 12, 0, 0, 0);
    return {
      date,
      inMonth: date.getMonth() === monthStart.getMonth(),
      disabled: date > today,
      dateValue: toDateValue(date),
    };
  });
}

function watchedAtToDateValue(raw?: string): string | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function roleLabel(character: string): "Dublagem" | "Atuacao" {
  const normalized = character.toLowerCase();
  return normalized.includes("voice") || normalized.includes("voz") ? "Dublagem" : "Atuacao";
}

function formatDate(value?: string): string {
  if (!value) return "Data indisponivel";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default function DetailMenuSections({ cast, mediaType, tmdbId, seasons }: DetailMenuSectionsProps) {
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number>(seasons[0]?.seasonNumber ?? 1);
  const [userId, setUserId] = useState<number | null>(null);
  const [watchedEpisodeKeys, setWatchedEpisodeKeys] = useState<Set<string>>(new Set());
  const [episodeToggleLoadingKey, setEpisodeToggleLoadingKey] = useState<string | null>(null);
  const [episodeWatchedDates, setEpisodeWatchedDates] = useState<Record<string, string>>({});
  const [openEpisodeDateKey, setOpenEpisodeDateKey] = useState<string | null>(null);
  const [calendarMonthStart, setCalendarMonthStart] = useState<Date>(() => startOfMonth(new Date()));
  const [previousEpisodesConfirm, setPreviousEpisodesConfirm] = useState<PreviousEpisodesConfirmState | null>(null);

  const castPreview = useMemo(() => cast.slice(0, 16), [cast]);
  const selectedSeason =
    seasons.find((season) => season.seasonNumber === selectedSeasonNumber) ?? seasons[0] ?? null;
  const isExpanded = activeSection !== null;
  const watchUrl =
    mediaType === "movie"
      ? `https://www.vidking.net/embed/movie/${tmdbId}`
      : `https://www.vidking.net/embed/tv/${tmdbId}/1/1`;

  useEffect(() => {
    if (isExpanded) {
      document.body.classList.add("detail-scroll-unlocked");
      return () => {
        document.body.classList.remove("detail-scroll-unlocked");
      };
    }

    document.body.classList.remove("detail-scroll-unlocked");
    return undefined;
  }, [isExpanded]);

  useEffect(() => {
    if (!seasons.length) return;
    setSelectedSeasonNumber(seasons[0].seasonNumber);
  }, [tmdbId, seasons]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tracksm_auth");
      if (!raw) {
        setUserId(null);
        return;
      }
      const parsed = JSON.parse(raw) as StoredAuth;
      setUserId(typeof parsed.id === "number" ? parsed.id : null);
    } catch {
      setUserId(null);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setWatchedEpisodeKeys(new Set());
      return;
    }

    if (mediaType !== "tv") return;

    async function loadWatched() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/user/watched?userId=${userId}&mediaType=${mediaType}&tmdbId=${tmdbId}`,
        );
        if (!response.ok) return;
        const data = (await response.json()) as WatchedItem[];

        const keys = new Set<string>(
          data
            .filter((item) => item.seasonNumber > 0 && item.episodeNumber > 0)
            .map((item) => `${item.seasonNumber}:${item.episodeNumber}`),
        );
        const dateByKey = data
          .filter((item) => item.seasonNumber > 0 && item.episodeNumber > 0)
          .reduce<Record<string, string>>((acc, item) => {
            const parsedDate = watchedAtToDateValue(item.watchedAt);
            if (!parsedDate) return acc;
            acc[`${item.seasonNumber}:${item.episodeNumber}`] = parsedDate;
            return acc;
          }, {});
        setWatchedEpisodeKeys(keys);
        setEpisodeWatchedDates(dateByKey);
      } catch {
        // noop
      }
    }

    void loadWatched();
  }, [userId, mediaType, tmdbId]);

  useEffect(() => {
    if (!openEpisodeDateKey) return;

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(`[data-episode-picker-key="${openEpisodeDateKey}"]`)) return;
      setOpenEpisodeDateKey(null);
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenEpisodeDateKey(null);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [openEpisodeDateKey]);

  function getEpisodeWatchedDate(key: string): string {
    return episodeWatchedDates[key] || getTodayValue();
  }

  function getPreviousEpisodeKeys(seasonNumber: number, episodeNumber: number): string[] {
    const orderedEpisodeKeys = seasons
      .slice()
      .sort((a, b) => a.seasonNumber - b.seasonNumber)
      .flatMap((season) =>
        season.episodes
          .slice()
          .sort((a, b) => a.episodeNumber - b.episodeNumber)
          .map((episode) => `${season.seasonNumber}:${episode.episodeNumber}`),
      );

    const targetKey = `${seasonNumber}:${episodeNumber}`;
    const targetIndex = orderedEpisodeKeys.indexOf(targetKey);
    if (targetIndex <= 0) return [];
    return orderedEpisodeKeys.slice(0, targetIndex);
  }

  async function upsertEpisodeWatched(keys: string[], watchedAt: string, loadingKey: string) {
    if (!userId || episodeToggleLoadingKey) return;
    setEpisodeToggleLoadingKey(loadingKey);
    try {
      const successfulKeys: string[] = [];
      for (const key of keys) {
        const [seasonNumberRaw, episodeNumberRaw] = key.split(":");
        const seasonNumber = Number(seasonNumberRaw);
        const episodeNumber = Number(episodeNumberRaw);
        const response = await fetch(`${API_BASE_URL}/api/user/watched`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            mediaType: "tv",
            tmdbId: Number(tmdbId),
            seasonNumber,
            episodeNumber,
            watchedAt,
          }),
        });
        if (response.ok) {
          successfulKeys.push(key);
        }
      }

      if (!successfulKeys.length) return;

      setWatchedEpisodeKeys((prev) => {
        const next = new Set(prev);
        successfulKeys.forEach((key) => next.add(key));
        return next;
      });
      setEpisodeWatchedDates((prev) => {
        const next = { ...prev };
        successfulKeys.forEach((key) => {
          next[key] = watchedAt;
        });
        return next;
      });
    } finally {
      setEpisodeToggleLoadingKey(null);
    }
  }

  async function markEpisodeWatchedWithPreviousPrompt(
    seasonNumber: number,
    episodeNumber: number,
    watchedAt: string,
    key: string,
  ) {
    const previousEpisodeKeys = getPreviousEpisodeKeys(seasonNumber, episodeNumber);
    const missingPreviousKeys = previousEpisodeKeys.filter((episodeKey) => !watchedEpisodeKeys.has(episodeKey));

    if (!missingPreviousKeys.length) {
      await upsertEpisodeWatched([key], watchedAt, key);
      return;
    }

    setPreviousEpisodesConfirm({
      key,
      watchedAt,
      missingPreviousKeys,
    });
    setOpenEpisodeDateKey(null);
  }

  function confirmMarkOnlyCurrent() {
    if (!previousEpisodesConfirm) return;
    const { key, watchedAt } = previousEpisodesConfirm;
    setPreviousEpisodesConfirm(null);
    void upsertEpisodeWatched([key], watchedAt, key);
  }

  function confirmMarkCurrentAndPrevious() {
    if (!previousEpisodesConfirm) return;
    const { key, watchedAt, missingPreviousKeys } = previousEpisodesConfirm;
    setPreviousEpisodesConfirm(null);
    void upsertEpisodeWatched([...missingPreviousKeys, key], watchedAt, key);
  }

  function closePreviousEpisodesConfirm() {
    setPreviousEpisodesConfirm(null);
  }

  async function toggleEpisodeWatched(seasonNumber: number, episodeNumber: number) {
    if (!userId || episodeToggleLoadingKey) return;
    const key = `${seasonNumber}:${episodeNumber}`;
    const isWatched = watchedEpisodeKeys.has(key);
    try {
      if (!isWatched) {
        await markEpisodeWatchedWithPreviousPrompt(seasonNumber, episodeNumber, getEpisodeWatchedDate(key), key);
        return;
      }

      setEpisodeToggleLoadingKey(key);
      const response = await fetch(`${API_BASE_URL}/api/user/watched`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          mediaType: "tv",
          tmdbId: Number(tmdbId),
          seasonNumber,
          episodeNumber,
        }),
      });
      if (!response.ok) return;
      setWatchedEpisodeKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setEpisodeWatchedDates((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } finally {
      setEpisodeToggleLoadingKey(null);
    }
  }

  function openEpisodeDatePicker(key: string) {
    if (!userId || episodeToggleLoadingKey) return;
    if (openEpisodeDateKey === key) {
      setOpenEpisodeDateKey(null);
      return;
    }
    const sourceValue = getEpisodeWatchedDate(key);
    setCalendarMonthStart(startOfMonth(fromDateValue(sourceValue)));
    setOpenEpisodeDateKey(key);
  }

  function handleEpisodeDateChange(seasonNumber: number, episodeNumber: number, value: string) {
    if (!value || !userId || episodeToggleLoadingKey) return;
    const key = `${seasonNumber}:${episodeNumber}`;
    if (watchedEpisodeKeys.has(key)) {
      void upsertEpisodeWatched([key], value, key);
      setOpenEpisodeDateKey(null);
      return;
    }

    void markEpisodeWatchedWithPreviousPrompt(seasonNumber, episodeNumber, value, key);
    setOpenEpisodeDateKey(null);
  }

  return (
    <section className={`detail-menu-wrapper${isExpanded ? " is-open" : ""}`} aria-label="Menu de detalhes">
      <div className="detail-menu-shell">
        <div className="detail-menu-card">
          <button
            type="button"
            className={`detail-menu-box${activeSection === "cast" ? " is-active" : ""}`}
            aria-expanded={activeSection === "cast"}
            onClick={() => setActiveSection((prev) => (prev === "cast" ? null : "cast"))}
          >
            Elenco
          </button>
          <button
            type="button"
            className={`detail-menu-box${activeSection === "watch" ? " is-active" : ""}`}
            aria-expanded={activeSection === "watch"}
            onClick={() => setActiveSection((prev) => (prev === "watch" ? null : "watch"))}
          >
            Assistir agora
          </button>
          {mediaType === "tv" ? (
            <button
              type="button"
              className={`detail-menu-box${activeSection === "seasons" ? " is-active" : ""}`}
              aria-expanded={activeSection === "seasons"}
              onClick={() => setActiveSection((prev) => (prev === "seasons" ? null : "seasons"))}
            >
              Temporadas
            </button>
          ) : null}
        </div>

        {activeSection === "cast" ? (
          <div className="detail-expandable-panel" role="region" aria-label="Elenco do filme ou serie">
            {castPreview.length ? (
              <ul className="detail-cast-grid">
                {castPreview.map((person) => (
                  <li className="detail-cast-item" key={person.id}>
                    <Link
                      href={`/pessoa/${person.id}?name=${encodeURIComponent(person.name)}`}
                      className="detail-cast-link"
                      aria-label={`Ver trabalhos de ${person.name}`}
                    >
                      {person.profileUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="detail-cast-photo" src={person.profileUrl} alt={person.name} loading="lazy" />
                      ) : (
                        <div className="detail-cast-photo detail-cast-photo-empty" aria-hidden="true" />
                      )}
                      <div className="detail-cast-text">
                        <p className="detail-cast-name">{person.name}</p>
                        <p className="detail-cast-role">{person.character || "Personagem nao informado"}</p>
                        <p className="detail-cast-tag">{roleLabel(person.character || "")}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="detail-expandable-empty">Nao foi possivel carregar elenco para este titulo.</p>
            )}
          </div>
        ) : null}

        {activeSection === "watch" ? (
          <div className="detail-expandable-panel" role="region" aria-label="Opcoes para assistir">
            <div className="detail-watch-player">
              <iframe
                src={watchUrl}
                title="Player Cineby"
                loading="lazy"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        ) : null}

        {activeSection === "seasons" ? (
          <div className="detail-expandable-panel" role="region" aria-label="Temporadas e episodios">
            {seasons.length ? (
              <>
                <div className="season-tabs">
                  {seasons.map((season) => (
                    <button
                      key={season.seasonNumber}
                      type="button"
                      className={`season-tab${selectedSeasonNumber === season.seasonNumber ? " is-active" : ""}`}
                      onClick={() => setSelectedSeasonNumber(season.seasonNumber)}
                    >
                      T{season.seasonNumber}
                    </button>
                  ))}
                </div>

                {selectedSeason ? (
                  <div className="season-panel">
                    <p className="season-heading">
                      {selectedSeason.seasonName} ({selectedSeason.episodeCount} episodios)
                    </p>
                    <ul className="season-episode-cards">
                      {selectedSeason.episodes.map((episode) => {
                        const episodeKey = `${selectedSeason.seasonNumber}:${episode.episodeNumber}`;
                        const isLoading = episodeToggleLoadingKey === episodeKey;
                        const selectedDateValue = getEpisodeWatchedDate(episodeKey);
                        const selectedDate = fromDateValue(selectedDateValue);
                        const monthLabel = new Intl.DateTimeFormat("pt-BR", {
                          month: "long",
                          year: "numeric",
                        }).format(calendarMonthStart);
                        const days = buildCalendarDays(calendarMonthStart);
                        const todayDate = fromDateValue(getTodayValue());

                        return (
                          <li key={episode.id} className="season-episode-card">
                            <div className="season-episode-thumb-wrap">
                              {episode.stillUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  className="season-episode-thumb"
                                  src={episode.stillUrl}
                                  alt={`Cena do episodio ${episode.episodeNumber}: ${episode.name}`}
                                  loading="lazy"
                                />
                              ) : (
                                <div className="season-episode-thumb season-episode-thumb-empty" aria-hidden="true" />
                              )}
                            </div>
                            <div className="season-episode-body">
                              <p className="season-episode-title">
                                <span className="season-episode-number">E{episode.episodeNumber.toString().padStart(2, "0")}</span>{" "}
                                {episode.name}
                              </p>
                              <p className="season-episode-date">{formatDate(episode.airDate)}</p>
                              {episode.overview?.trim() ? (
                                <p className="season-episode-overview">{episode.overview.trim()}</p>
                              ) : null}

                              <div className="episode-watch-actions">
                                <button
                                  type="button"
                                  className={`episode-watch-toggle${watchedEpisodeKeys.has(episodeKey) ? " is-watched" : ""}`}
                                  onClick={() => void toggleEpisodeWatched(selectedSeason.seasonNumber, episode.episodeNumber)}
                                  disabled={!userId || isLoading}
                                >
                                  {watchedEpisodeKeys.has(episodeKey) ? "Visto" : "Ver"}
                                </button>
                                <div className="episode-date-picker">
                                  <button
                                    type="button"
                                    className="episode-date-trigger"
                                    aria-label={`Selecionar data vista do episodio ${episode.episodeNumber}`}
                                    title="Selecionar data vista"
                                    onClick={() => openEpisodeDatePicker(episodeKey)}
                                    disabled={!userId || isLoading}
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
                                      <path d="M7 3.5v3M17 3.5v3M3.5 9.5h17M8 13h3M13 13h3M8 17h3" />
                                    </svg>
                                  </button>
                                  {openEpisodeDateKey === episodeKey ? (
                                    <div className="episode-date-popover" data-episode-picker-key={episodeKey}>
                                      <div className="episode-calendar-head">
                                        <button
                                          type="button"
                                          className="episode-calendar-nav"
                                          onClick={() =>
                                            setCalendarMonthStart(
                                              new Date(
                                                calendarMonthStart.getFullYear(),
                                                calendarMonthStart.getMonth() - 1,
                                                1,
                                                12,
                                                0,
                                                0,
                                                0,
                                              ),
                                            )
                                          }
                                          aria-label="Mes anterior"
                                        >
                                          <span aria-hidden="true">{"\u2039"}</span>
                                        </button>
                                        <strong className="episode-calendar-title">{monthLabel}</strong>
                                        <button
                                          type="button"
                                          className="episode-calendar-nav"
                                          onClick={() =>
                                            setCalendarMonthStart(
                                              new Date(
                                                calendarMonthStart.getFullYear(),
                                                calendarMonthStart.getMonth() + 1,
                                                1,
                                                12,
                                                0,
                                                0,
                                                0,
                                              ),
                                            )
                                          }
                                          aria-label="Proximo mes"
                                        >
                                          <span aria-hidden="true">{"\u203A"}</span>
                                        </button>
                                      </div>
                                      <div className="episode-calendar-weekdays">
                                        {WEEKDAY_LABELS.map((label, index) => (
                                          <span key={`${label}-${index}`}>{label}</span>
                                        ))}
                                      </div>
                                      <div className="episode-calendar-grid">
                                        {days.map((day) => (
                                          <button
                                            key={day.dateValue}
                                            type="button"
                                            className={`episode-calendar-day${day.inMonth ? "" : " is-outside"}${
                                              sameDay(day.date, selectedDate) ? " is-selected" : ""
                                            }${sameDay(day.date, todayDate) ? " is-today" : ""}`}
                                            disabled={day.disabled}
                                            onClick={() =>
                                              handleEpisodeDateChange(
                                                selectedSeason.seasonNumber,
                                                episode.episodeNumber,
                                                day.dateValue,
                                              )
                                            }
                                          >
                                            {day.date.getDate()}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="detail-expandable-empty">Nao foi possivel carregar temporadas para esta serie.</p>
            )}
          </div>
        ) : null}
      </div>
      {previousEpisodesConfirm ? (
        <div className="episode-confirm-overlay" role="presentation" onClick={closePreviousEpisodesConfirm}>
          <div
            className="episode-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar marcacao de episodios anteriores"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="episode-confirm-title">Marcar episodios anteriores?</p>
            <p className="episode-confirm-text">
              Existem {previousEpisodesConfirm.missingPreviousKeys.length} episodio(s) anteriores nao vistos.
            </p>
            <p className="episode-confirm-text">Deseja marcar os anteriores como vistos tambem?</p>
            <div className="episode-confirm-actions">
              <button type="button" className="episode-confirm-button secondary" onClick={confirmMarkOnlyCurrent}>
                So este episodio
              </button>
              <button type="button" className="episode-confirm-button primary" onClick={confirmMarkCurrentAndPrevious}>
                Marcar anteriores
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
