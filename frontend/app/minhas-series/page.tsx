"use client";

import Link from "next/link";
import { WheelEvent, useEffect, useMemo, useRef, useState } from "react";
import LoadingSpinner from "../components/loading-spinner";
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
  backdropUrl: string | null;
  logoUrl: string | null;
  showStatus: string | null;
  firstAirDate: string | null;
  totalEpisodes: number | null;
  averageEpisodeRuntime: number | null;
};

type SeriesProgress = {
  id: number;
  name: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  logoUrl: string | null;
  showStatus: string | null;
  firstAirDate: string | null;
  watchedEpisodes: number;
  remainingEpisodes: number | null;
  totalEpisodes: number | null;
};

type SeriesEpisode = {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string | null;
  stillUrl: string | null;
  overview: string;
};

type MovieSummary = {
  id: number;
  title: string;
  posterUrl: string | null;
  runtime: number | null;
};

type SeriesHistoryItem = SeriesProgress & {
  status: "completed" | "in_progress";
  lastActivityAt: string | null;
  watchedMinutes: number | null;
  progressPercent: number;
};

type HistoryColumnKey = "image" | "status" | "pending" | "showStatus" | "year" | "timeSpent" | "progress";
type HistorySortKey = "name" | "status" | "pending" | "showStatus" | "year" | "timeSpent" | "progress";
type SortDirection = "asc" | "desc";

type MySeriesView = "series" | "history" | "movies" | "stats";
type StatsMediaType = "tv" | "movie";

const API_BASE_URL = getApiBaseUrl();
const MY_SERIES_VIEW_MODE_KEY = "tracksm_my_series_view_mode";

function sortSeriesProgress(progress: SeriesProgress[]): SeriesProgress[] {
  return [...progress].sort((a, b) => {
    if (a.remainingEpisodes === null && b.remainingEpisodes === null) return a.name.localeCompare(b.name);
    if (a.remainingEpisodes === null) return 1;
    if (b.remainingEpisodes === null) return -1;
    if (a.remainingEpisodes !== b.remainingEpisodes) return a.remainingEpisodes - b.remainingEpisodes;
    return b.watchedEpisodes - a.watchedEpisodes;
  });
}

function formatEpisodeAirDate(airDate: string | null): string {
  if (!airDate) return "Data de lancamento indisponivel";
  const parsed = new Date(`${airDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Data de lancamento indisponivel";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
  }).format(parsed);
}

function toDateKey(input: string | undefined): string | null {
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

function getMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

function getTodayValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 min";
  const days = Math.floor(totalMinutes / (60 * 24));
  const remainderAfterDays = totalMinutes % (60 * 24);
  const hours = Math.floor(remainderAfterDays / 60);
  const minutes = remainderAfterDays % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}min`;
  }
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

function formatHistoryDate(input: string | null): string {
  if (!input) return "Data indisponivel";
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return "Data indisponivel";
  return parsed.toLocaleDateString("pt-BR");
}

function showStatusLabel(raw: string | null): string {
  if (!raw) return "Desconhecido";
  const normalized = raw.toLowerCase();
  if (normalized === "ended") return "Encerrada";
  if (normalized === "returning series") return "Em exibicao";
  if (normalized === "canceled") return "Cancelada";
  if (normalized === "in production") return "Em producao";
  if (normalized === "planned") return "Planejada";
  return raw;
}

function showStatusSortRank(raw: string | null): number {
  const label = showStatusLabel(raw).toLowerCase();
  if (label === "cancelada") return 0;
  if (label === "encerrada" || label === "finalizado") return 1;
  if (label === "planejada" || label === "em breve") return 2;
  if (label === "em exibicao") return 3;
  if (label === "em producao") return 4;
  return 5;
}

export default function MinhasSeriesPage() {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [seriesProgress, setSeriesProgress] = useState<SeriesProgress[]>([]);
  const [movieHistory, setMovieHistory] = useState<MovieSummary[]>([]);
  const [watchedBySeries, setWatchedBySeries] = useState<Map<number, Set<string>>>(new Map());
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [selectedSeriesEpisodes, setSelectedSeriesEpisodes] = useState<SeriesEpisode[]>([]);
  const [viewMode, setViewMode] = useState<MySeriesView>("series");
  const [statsMonth, setStatsMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nextEpisodeError, setNextEpisodeError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEpisodeLoading, setIsEpisodeLoading] = useState(false);
  const [isMarkingEpisode, setIsMarkingEpisode] = useState(false);
  const [watchedDate, setWatchedDate] = useState<string>(getTodayValue());
  const [watchedTvItems, setWatchedTvItems] = useState<WatchedItem[]>([]);
  const [watchedMovieItems, setWatchedMovieItems] = useState<WatchedItem[]>([]);
  const [seriesPosterById, setSeriesPosterById] = useState<Map<number, string | null>>(new Map());
  const [seriesNameById, setSeriesNameById] = useState<Map<number, string>>(new Map());
  const [seriesRuntimeById, setSeriesRuntimeById] = useState<Map<number, number | null>>(new Map());
  const [moviePosterById, setMoviePosterById] = useState<Map<number, string | null>>(new Map());
  const [movieTitleById, setMovieTitleById] = useState<Map<number, string>>(new Map());
  const [movieRuntimeById, setMovieRuntimeById] = useState<Map<number, number | null>>(new Map());
  const [historySearch, setHistorySearch] = useState<string>("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "pending" | "up_to_date">("all");
  const [historySort, setHistorySort] = useState<{ key: HistorySortKey | null; direction: SortDirection }>({
    key: null,
    direction: "desc",
  });
  const [isHistoryColumnsMenuOpen, setIsHistoryColumnsMenuOpen] = useState(false);
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState<Record<HistoryColumnKey, boolean>>({
    image: true,
    status: true,
    pending: true,
    showStatus: true,
    year: true,
    timeSpent: true,
    progress: true,
  });
  const historyColumnsMenuRef = useRef<HTMLDivElement | null>(null);

  function handleHorizontalWheel(event: WheelEvent<HTMLElement>) {
    const container = event.currentTarget;
    const canScrollHorizontally = container.scrollWidth > container.clientWidth;
    if (!canScrollHorizontally) return;

    // Trackpad horizontal gesture still works natively; convert vertical wheel into horizontal scroll.
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    container.scrollLeft += event.deltaY;
  }

  const seriesWithRemainingEpisodes = useMemo(
    () => seriesProgress.filter((series) => series.remainingEpisodes !== null && series.remainingEpisodes > 0),
    [seriesProgress],
  );
  const seriesHistory = useMemo<SeriesHistoryItem[]>(() => {
    const lastActivityBySeries = new Map<number, number>();

    for (const item of watchedTvItems) {
      const parsed = item.watchedAt ? Date.parse(item.watchedAt) : Number.NaN;
      if (Number.isNaN(parsed)) continue;
      const current = lastActivityBySeries.get(item.tmdbId) ?? 0;
      if (parsed > current) {
        lastActivityBySeries.set(item.tmdbId, parsed);
      }
    }

    return seriesProgress
      .map((series) => {
        const totalEpisodes = series.totalEpisodes ?? null;
        const progressPercent =
          totalEpisodes && totalEpisodes > 0 ? Math.min(100, Math.round((series.watchedEpisodes / totalEpisodes) * 100)) : 0;
        const lastActivityTimestamp = lastActivityBySeries.get(series.id) ?? null;
        const runtimePerEpisode = seriesRuntimeById.get(series.id) ?? null;
        const watchedMinutes =
          runtimePerEpisode && runtimePerEpisode > 0 ? runtimePerEpisode * series.watchedEpisodes : null;
        const status: "completed" | "in_progress" =
          totalEpisodes && totalEpisodes > 0 && series.remainingEpisodes === 0 ? "completed" : "in_progress";

        return {
          ...series,
          status,
          lastActivityAt: lastActivityTimestamp ? new Date(lastActivityTimestamp).toISOString() : null,
          watchedMinutes,
          progressPercent,
        };
      })
      .sort((a, b) => {
        const aTime = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
        const bTime = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
        if (aTime !== bTime) return bTime - aTime;
        return a.name.localeCompare(b.name);
      });
  }, [seriesProgress, watchedTvItems, seriesRuntimeById]);
  const filteredSeriesHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    const filtered = seriesHistory.filter((series) => {
      const matchesQuery = !query || series.name.toLowerCase().includes(query);
      const matchesStatus =
        historyStatusFilter === "all" ||
        (historyStatusFilter === "up_to_date" && series.status === "completed") ||
        (historyStatusFilter === "pending" && series.status === "in_progress");
      return matchesQuery && matchesStatus;
    });

    if (!historySort.key) {
      // Default order follows watch history (already sorted by last activity desc in seriesHistory).
      return filtered;
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (historySort.key) {
        case "name":
          return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
        case "status": {
          const rankA = a.status === "in_progress" ? 0 : 1;
          const rankB = b.status === "in_progress" ? 0 : 1;
          return rankA - rankB;
        }
        case "pending": {
          const valA = a.remainingEpisodes ?? Number.MAX_SAFE_INTEGER;
          const valB = b.remainingEpisodes ?? Number.MAX_SAFE_INTEGER;
          return valA - valB;
        }
        case "showStatus": {
          const rankA = showStatusSortRank(a.showStatus);
          const rankB = showStatusSortRank(b.showStatus);
          if (rankA !== rankB) return rankA - rankB;
          return showStatusLabel(a.showStatus).localeCompare(showStatusLabel(b.showStatus), "pt-BR", { sensitivity: "base" });
        }
        case "year": {
          const yearA = Number(a.firstAirDate?.slice(0, 4)) || 0;
          const yearB = Number(b.firstAirDate?.slice(0, 4)) || 0;
          return yearA - yearB;
        }
        case "timeSpent": {
          const minA = a.watchedMinutes ?? -1;
          const minB = b.watchedMinutes ?? -1;
          return minA - minB;
        }
        case "progress":
          return a.progressPercent - b.progressPercent;
        default:
          return 0;
      }
    });

    return historySort.direction === "asc" ? sorted : sorted.reverse();
  }, [historySearch, historyStatusFilter, seriesHistory, historySort]);
  const historyGridTemplate = useMemo(() => {
    const parts: string[] = [];
    if (visibleHistoryColumns.image) parts.push("200px");
    parts.push("minmax(180px, 1.5fr)");
    if (visibleHistoryColumns.status) parts.push("minmax(130px, 0.95fr)");
    if (visibleHistoryColumns.pending) parts.push("88px");
    if (visibleHistoryColumns.showStatus) parts.push("minmax(130px, 0.95fr)");
    if (visibleHistoryColumns.year) parts.push("72px");
    if (visibleHistoryColumns.timeSpent) parts.push("100px");
    if (visibleHistoryColumns.progress) parts.push("minmax(180px, 1.25fr)");
    return parts.join(" ");
  }, [visibleHistoryColumns]);

  function toggleHistorySort(key: HistorySortKey) {
    setHistorySort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  }

  function sortIndicator(key: HistorySortKey): string {
    if (!historySort.key || historySort.key !== key) return "<>";
    return historySort.direction === "asc" ? "^" : "v";
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (historyColumnsMenuRef.current?.contains(target)) return;
      setIsHistoryColumnsMenuOpen(false);
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setIsHistoryColumnsMenuOpen(false);
    }

    if (!isHistoryColumnsMenuOpen) return;
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isHistoryColumnsMenuOpen]);

  const selectedSeries =
    seriesWithRemainingEpisodes.find((series) => series.id === selectedSeriesId) ?? seriesWithRemainingEpisodes[0] ?? null;
  const selectedWatchedKeys = selectedSeries ? watchedBySeries.get(selectedSeries.id) ?? new Set<string>() : new Set<string>();
  const nextEpisodeToWatch =
    selectedSeriesEpisodes.find((episode) => !selectedWatchedKeys.has(`${episode.seasonNumber}:${episode.episodeNumber}`)) ?? null;
  const watchedStatsByDay = useMemo(() => {
    const dayMap = new Map<string, { totalViews: number; mediaCountById: Map<string, number> }>();

    function accumulate(items: WatchedItem[], mediaType: StatsMediaType) {
      for (const item of items) {
        const key = toDateKey(item.watchedAt);
        if (!key) continue;

        const mediaKey = `${mediaType}:${item.tmdbId}`;
        const current = dayMap.get(key) ?? { totalViews: 0, mediaCountById: new Map<string, number>() };
        current.totalViews += 1;
        current.mediaCountById.set(mediaKey, (current.mediaCountById.get(mediaKey) ?? 0) + 1);
        dayMap.set(key, current);
      }
    }

    accumulate(watchedTvItems, "tv");
    accumulate(watchedMovieItems, "movie");

    return dayMap;
  }, [watchedTvItems, watchedMovieItems]);
  const statsDays = useMemo(() => {
    const firstOfMonth = new Date(statsMonth.getFullYear(), statsMonth.getMonth(), 1);
    const firstWeekday = firstOfMonth.getDay();
    const firstCellDate = new Date(firstOfMonth);
    firstCellDate.setDate(firstOfMonth.getDate() - firstWeekday);

    return Array.from({ length: 42 }, (_, index) => {
      const dayDate = new Date(firstCellDate);
      dayDate.setDate(firstCellDate.getDate() + index);
      const dayKey = `${dayDate.getFullYear()}-${`${dayDate.getMonth() + 1}`.padStart(2, "0")}-${`${dayDate.getDate()}`.padStart(2, "0")}`;
      const stats = watchedStatsByDay.get(dayKey);
      const mediaKeys =
        stats
          ? Array.from(stats.mediaCountById.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([mediaKey]) => mediaKey)
              .slice(0, 3)
          : [];

      return {
        date: dayDate,
        key: dayKey,
        isCurrentMonth: dayDate.getMonth() === statsMonth.getMonth(),
        totalViews: stats?.totalViews ?? 0,
        mediaKeys,
      };
    });
  }, [statsMonth, watchedStatsByDay]);
  const monthHeatmapDays = useMemo(() => {
    const points = statsDays.map((day) => ({
      key: day.key,
      date: day.date,
      isCurrentMonth: day.isCurrentMonth,
      totalViews: day.totalViews,
    }));
    const maxViews = points.reduce((max, point) => Math.max(max, point.totalViews), 0);
    return { points, maxViews };
  }, [statsDays]);
  const totalSeriesEpisodesWatched = watchedTvItems.length;
  const totalSeriesMinutesWatched = useMemo(
    () =>
      seriesProgress.reduce((total, series) => {
        const runtime = seriesRuntimeById.get(series.id);
        if (!runtime || runtime <= 0) return total;
        return total + runtime * series.watchedEpisodes;
      }, 0),
    [seriesProgress, seriesRuntimeById],
  );
  const totalMoviesWatched = movieHistory.length;
  const totalMovieMinutesWatched = useMemo(
    () =>
      movieHistory.reduce((total, movie) => {
        const runtime = movieRuntimeById.get(movie.id);
        return runtime && runtime > 0 ? total + runtime : total;
      }, 0),
    [movieHistory, movieRuntimeById],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tracksm_auth");
      if (raw) {
        const parsed = JSON.parse(raw) as StoredAuth;
        if (parsed?.id && parsed?.name) setAuth(parsed);
      }

      const savedViewMode = localStorage.getItem(MY_SERIES_VIEW_MODE_KEY);
      if (savedViewMode === "completed") {
        setViewMode("history");
        return;
      }
      if (
        savedViewMode === "series" ||
        savedViewMode === "history" ||
        savedViewMode === "movies" ||
        savedViewMode === "stats"
      ) {
        setViewMode(savedViewMode as MySeriesView);
      }
    } catch {
      setAuth(null);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MY_SERIES_VIEW_MODE_KEY, viewMode);
    } catch {
      // noop
    }
  }, [viewMode]);

  useEffect(() => {
    if (!auth?.id) return;
    const userId = auth.id;

    async function loadProgress() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [watchedTvResponse, watchedMovieResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/user/watched?userId=${userId}&mediaType=tv`),
          fetch(`${API_BASE_URL}/api/user/watched?userId=${userId}&mediaType=movie`),
        ]);

        if (!watchedTvResponse.ok) {
          throw new Error("Nao foi possivel carregar episodios assistidos.");
        }
        if (!watchedMovieResponse.ok) {
          throw new Error("Nao foi possivel carregar filmes vistos.");
        }

        const watchedTvItems = (await watchedTvResponse.json()) as WatchedItem[];
        const watchedMovieItems = (await watchedMovieResponse.json()) as WatchedItem[];

        const tvWatchedEpisodes = watchedTvItems.filter((item) => item.seasonNumber > 0 && item.episodeNumber > 0);
        setWatchedTvItems(tvWatchedEpisodes);
        if (!tvWatchedEpisodes.length) {
          setSeriesProgress([]);
          setWatchedBySeries(new Map());
          setSeriesPosterById(new Map());
          setSeriesNameById(new Map());
          setSeriesRuntimeById(new Map());
        } else {
          const uniqueByEpisode = new Map<string, WatchedItem>();
          for (const item of tvWatchedEpisodes) {
            const key = `${item.tmdbId}:${item.seasonNumber}:${item.episodeNumber}`;
            uniqueByEpisode.set(key, item);
          }
          const deduped = Array.from(uniqueByEpisode.values());

          const watchedPerSeries = new Map<number, Set<string>>();
          for (const item of deduped) {
            const current = watchedPerSeries.get(item.tmdbId) ?? new Set<string>();
            current.add(`${item.seasonNumber}:${item.episodeNumber}`);
            watchedPerSeries.set(item.tmdbId, current);
          }

          const ids = Array.from(watchedPerSeries.keys());
          const summariesResponse = await fetch(`/api/tmdb/tv-summaries?ids=${ids.join(",")}`);
          if (!summariesResponse.ok) {
            throw new Error("Nao foi possivel carregar os detalhes das series.");
          }
          const summaries = (await summariesResponse.json()) as TvSummary[];
          const summaryById = new Map<number, TvSummary>(summaries.map((summary) => [summary.id, summary]));
          setSeriesPosterById(new Map(summaries.map((summary) => [summary.id, summary.posterUrl])));
          setSeriesNameById(new Map(summaries.map((summary) => [summary.id, summary.name])));
          setSeriesRuntimeById(new Map(summaries.map((summary) => [summary.id, summary.averageEpisodeRuntime])));

          const progress: SeriesProgress[] = ids.map((id) => {
            const watchedEpisodes = watchedPerSeries.get(id)?.size ?? 0;
            const summary = summaryById.get(id);
            const totalEpisodes = summary?.totalEpisodes ?? null;
            return {
              id,
              name: summary?.name ?? `Serie ${id}`,
              posterUrl: summary?.posterUrl ?? null,
              backdropUrl: summary?.backdropUrl ?? null,
              logoUrl: summary?.logoUrl ?? null,
              showStatus: summary?.showStatus ?? null,
              firstAirDate: summary?.firstAirDate ?? null,
              watchedEpisodes,
              remainingEpisodes:
                totalEpisodes && totalEpisodes > 0 ? Math.max(totalEpisodes - watchedEpisodes, 0) : null,
              totalEpisodes,
            };
          });

          setWatchedBySeries(new Map(watchedPerSeries));
          setSeriesProgress(sortSeriesProgress(progress));
        }

        const watchedMovies = watchedMovieItems.filter((item) => item.seasonNumber === 0 && item.episodeNumber === 0);
        setWatchedMovieItems(watchedMovies);
        if (!watchedMovies.length) {
          setMovieHistory([]);
          setMoviePosterById(new Map());
          setMovieTitleById(new Map());
          setMovieRuntimeById(new Map());
        } else {
          const uniqueMovieIds = Array.from(new Set(watchedMovies.map((item) => item.tmdbId)));
          const movieSummariesResponse = await fetch(`/api/tmdb/movie-summaries?ids=${uniqueMovieIds.join(",")}`);
          if (!movieSummariesResponse.ok) {
            throw new Error("Nao foi possivel carregar os detalhes dos filmes.");
          }
          const movieSummaries = (await movieSummariesResponse.json()) as MovieSummary[];
          const movieSummaryById = new Map<number, MovieSummary>(movieSummaries.map((movie) => [movie.id, movie]));
          setMoviePosterById(new Map(movieSummaries.map((movie) => [movie.id, movie.posterUrl])));
          setMovieTitleById(new Map(movieSummaries.map((movie) => [movie.id, movie.title])));
          setMovieRuntimeById(new Map(movieSummaries.map((movie) => [movie.id, movie.runtime])));
          setMovieHistory(uniqueMovieIds.map((id) => movieSummaryById.get(id)).filter((item): item is MovieSummary => Boolean(item)));
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Falha ao carregar progresso.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadProgress();
  }, [auth?.id]);

  useEffect(() => {
    if (!seriesWithRemainingEpisodes.length) {
      setSelectedSeriesId(null);
      return;
    }

    const hasCurrentSelection = seriesWithRemainingEpisodes.some((series) => series.id === selectedSeriesId);
    if (!hasCurrentSelection) {
      setSelectedSeriesId(seriesWithRemainingEpisodes[0].id);
    }
  }, [selectedSeriesId, seriesWithRemainingEpisodes]);

  useEffect(() => {
    if (!selectedSeries?.id) {
      setSelectedSeriesEpisodes([]);
      setNextEpisodeError(null);
      return;
    }

    async function loadSelectedSeriesEpisodes() {
      setIsEpisodeLoading(true);
      setNextEpisodeError(null);
      try {
        const response = await fetch(`/api/tmdb/tv-episodes?id=${selectedSeries.id}`);
        if (!response.ok) {
          throw new Error("Nao foi possivel carregar os episodios da serie selecionada.");
        }
        const episodes = (await response.json()) as SeriesEpisode[];
        setSelectedSeriesEpisodes(episodes);
      } catch (error) {
        setSelectedSeriesEpisodes([]);
        setNextEpisodeError(error instanceof Error ? error.message : "Falha ao carregar episodio.");
      } finally {
        setIsEpisodeLoading(false);
      }
    }

    void loadSelectedSeriesEpisodes();
  }, [selectedSeries?.id]);

  async function markNextEpisodeAsWatched() {
    if (!auth?.id || !selectedSeries || !nextEpisodeToWatch || isMarkingEpisode) return;

    setIsMarkingEpisode(true);
    setNextEpisodeError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/watched`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.id,
          mediaType: "tv",
          tmdbId: selectedSeries.id,
          seasonNumber: nextEpisodeToWatch.seasonNumber,
          episodeNumber: nextEpisodeToWatch.episodeNumber,
          watchedAt: watchedDate,
        }),
      });

      if (!response.ok) {
        throw new Error("Nao foi possivel marcar o episodio como visto.");
      }

      const episodeKey = `${nextEpisodeToWatch.seasonNumber}:${nextEpisodeToWatch.episodeNumber}`;
      setWatchedBySeries((prev) => {
        const next = new Map(prev);
        const currentSet = new Set(next.get(selectedSeries.id) ?? []);
        currentSet.add(episodeKey);
        next.set(selectedSeries.id, currentSet);
        return next;
      });

      setSeriesProgress((prev) =>
        sortSeriesProgress(
          prev.map((item) => {
            if (item.id !== selectedSeries.id) return item;
            return {
              ...item,
              watchedEpisodes: item.watchedEpisodes + 1,
              remainingEpisodes: item.remainingEpisodes === null ? null : Math.max(item.remainingEpisodes - 1, 0),
            };
          }),
        ),
      );
      setWatchedTvItems((prev) => [
        ...prev,
        {
          tmdbId: selectedSeries.id,
          seasonNumber: nextEpisodeToWatch.seasonNumber,
          episodeNumber: nextEpisodeToWatch.episodeNumber,
          watchedAt: `${watchedDate}T12:00:00Z`,
        },
      ]);
    } catch (error) {
      setNextEpisodeError(error instanceof Error ? error.message : "Falha ao salvar progresso.");
    } finally {
      setIsMarkingEpisode(false);
    }
  }

  if (!isReady) {
    return (
      <main>
        <LoadingSpinner fullPage />
      </main>
    );
  }

  if (!auth) {
    return (
      <main className="auth-required-page">
        <section className="auth-required-card">
          <h1 className="auth-required-title">Minhas series</h1>
          <p className="auth-required-text">Voce precisa estar logado para visualizar os detalhes da sua lista.</p>
          <Link href="/login" className="auth-required-button">
            Entrar
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="my-series-page">
      <section className={`my-series-surface is-${viewMode}`}>
        {!isLoading && !errorMessage && (selectedSeries?.backdropUrl || selectedSeries?.posterUrl) ? (
          <div className="my-series-blue-poster" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedSeries.backdropUrl ?? selectedSeries.posterUrl ?? ""}
              alt=""
              className="my-series-blue-poster-image"
              loading="lazy"
            />
          </div>
        ) : null}

        <div className={`my-series-inner${viewMode === "movies" ? " is-movies" : ""}`}>
          <header className="header">
            <h1>Minhas series</h1>
          </header>

          {isLoading ? <LoadingSpinner fullPage label="Carregando progresso" /> : null}
          {errorMessage ? <p className="auth-feedback is-error">{errorMessage}</p> : null}

          {!isLoading && !errorMessage && !seriesProgress.length ? (
            <p className="subtitle">Voce ainda nao marcou episodios como vistos em nenhuma serie.</p>
          ) : null}

          {!isLoading && !errorMessage && (seriesProgress.length > 0 || movieHistory.length > 0) ? (
            <nav className="my-series-mode-menu" aria-label="Menu de secoes">
              <button
                type="button"
                className={`my-series-mode-item${viewMode === "series" ? " is-active" : ""}`}
                onClick={() => setViewMode("series")}
              >
                Series
              </button>
              <button
                type="button"
                className={`my-series-mode-item${viewMode === "movies" ? " is-active" : ""}`}
                onClick={() => setViewMode("movies")}
              >
                Filmes
              </button>
              <button
                type="button"
                className={`my-series-mode-item${viewMode === "history" ? " is-active" : ""}`}
                onClick={() => setViewMode("history")}
              >
                Historico
              </button>
              <button
                type="button"
                className={`my-series-mode-item${viewMode === "stats" ? " is-active" : ""}`}
                onClick={() => setViewMode("stats")}
              >
                Estatisticas
              </button>
            </nav>
          ) : null}

          {!isLoading && !errorMessage && viewMode === "series" && selectedSeries ? (
            <section className="my-series-selected-layer" aria-label="Serie selecionada">
              <Link href={`/detalhe/serie/${selectedSeries.id}`} className="my-series-selected-card" title={selectedSeries.name}>
                {selectedSeries.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="my-series-card-image" src={selectedSeries.posterUrl} alt={selectedSeries.name} loading="lazy" />
                ) : (
                  <div className="my-series-card-image my-series-card-image-empty" />
                )}
              </Link>

              <aside className="my-series-next-episode-card" aria-label="Proximo episodio para assistir">
                {isEpisodeLoading ? (
                  <div className="my-series-next-episode-status">
                    <LoadingSpinner compact label="Carregando proximo episodio" />
                  </div>
                ) : null}
                {!isEpisodeLoading && nextEpisodeError ? (
                  <p className="my-series-next-episode-status is-error">{nextEpisodeError}</p>
                ) : null}
                {!isEpisodeLoading && !nextEpisodeError && nextEpisodeToWatch ? (
                  <>
                    {nextEpisodeToWatch.stillUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={nextEpisodeToWatch.stillUrl}
                        alt={`Cena de ${selectedSeries.name}`}
                        className="my-series-next-episode-image"
                        loading="lazy"
                      />
                    ) : (
                      <div className="my-series-next-episode-image my-series-next-episode-image-empty" />
                    )}

                    <div className="my-series-next-episode-content">
                      <p className="my-series-next-episode-title">
                        <span className="my-series-next-episode-code">
                          T{nextEpisodeToWatch.seasonNumber.toString().padStart(2, "0")}E
                          {nextEpisodeToWatch.episodeNumber.toString().padStart(2, "0")}
                        </span>{" "}
                        {nextEpisodeToWatch.name}
                      </p>
                      <p className="my-series-next-episode-date">{formatEpisodeAirDate(nextEpisodeToWatch.airDate)}</p>
                      {nextEpisodeToWatch.overview?.trim() ? (
                        <p className="my-series-next-episode-overview">{nextEpisodeToWatch.overview.trim()}</p>
                      ) : null}
                      <label className="watched-date-field my-series-next-episode-date-field">
                        <span>Data vista</span>
                        <input
                          type="date"
                          className="watched-date-input"
                          value={watchedDate}
                          onChange={(event) => setWatchedDate(event.target.value)}
                          max={getTodayValue()}
                          disabled={!auth?.id || isMarkingEpisode}
                        />
                      </label>
                      <button
                        type="button"
                        className="my-series-next-episode-action"
                        onClick={() => void markNextEpisodeAsWatched()}
                        disabled={!auth?.id || isMarkingEpisode}
                      >
                        {isMarkingEpisode ? "Salvando..." : "Marcar como visto"}
                      </button>
                    </div>
                  </>
                ) : null}
                {!isEpisodeLoading && !nextEpisodeError && !nextEpisodeToWatch ? (
                  <p className="my-series-next-episode-status">Voce esta em dia com essa serie.</p>
                ) : null}
              </aside>
            </section>
          ) : null}

          {!isLoading && !errorMessage && viewMode === "series" && !seriesWithRemainingEpisodes.length && seriesProgress.length ? (
            <p className="subtitle my-series-done">Voce esta em dia com os episodios das suas series.</p>
          ) : null}

          {!isLoading && !errorMessage && viewMode === "series" && seriesWithRemainingEpisodes.length ? (
            <section className="my-series-strip" aria-label="Series com episodios restantes" onWheel={handleHorizontalWheel}>
              {seriesWithRemainingEpisodes.map((series) => (
                <button
                  key={series.id}
                  type="button"
                  className={`my-series-card ${selectedSeries?.id === series.id ? "is-selected" : ""}`}
                  onClick={() => setSelectedSeriesId(series.id)}
                  aria-label={`Selecionar ${series.name}`}
                >
                  {series.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="my-series-card-image" src={series.posterUrl} alt={series.name} loading="lazy" />
                  ) : (
                    <div className="my-series-card-image my-series-card-image-empty" />
                  )}
                  <span className="my-series-card-count-bar">{series.remainingEpisodes} episodios</span>
                </button>
              ))}
            </section>
          ) : null}

          {!isLoading && !errorMessage && viewMode === "movies" && !movieHistory.length ? (
            <p className="subtitle my-series-done">Voce ainda nao marcou filmes como vistos.</p>
          ) : null}

          {!isLoading && !errorMessage && viewMode === "movies" && movieHistory.length ? (
            <section className="my-series-strip is-movies" aria-label="Historico de filmes vistos">
              {movieHistory.map((movie) => (
                <Link key={movie.id} href={`/detalhe/filme/${movie.id}`} className="my-series-card" aria-label={`Abrir ${movie.title}`}>
                  {movie.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="my-series-card-image" src={movie.posterUrl} alt={movie.title} loading="lazy" />
                  ) : (
                    <div className="my-series-card-image my-series-card-image-empty" />
                  )}
                </Link>
              ))}
            </section>
          ) : null}

          {!isLoading && !errorMessage && viewMode === "history" && !seriesHistory.length ? (
            <p className="subtitle my-series-done">Voce ainda nao tem historico de series.</p>
          ) : null}

          {!isLoading && !errorMessage && viewMode === "history" && seriesHistory.length ? (
            <section
              className="my-series-completed-board"
              aria-label="Historico geral de series"
              style={{ ["--my-history-grid" as string]: historyGridTemplate }}
            >
              <div className="my-series-history-toolbar is-embedded">
                <div className="my-series-history-tools-left">
                  <input
                    type="search"
                    className="my-series-history-search"
                    value={historySearch}
                    onChange={(event) => setHistorySearch(event.target.value)}
                    placeholder="Buscar series..."
                    aria-label="Buscar serie por nome"
                  />
                  <select
                    className="my-series-history-status-select"
                    value={historyStatusFilter}
                    onChange={(event) => setHistoryStatusFilter(event.target.value as "all" | "pending" | "up_to_date")}
                    aria-label="Filtrar por status"
                  >
                    <option value="all">Status</option>
                    <option value="pending">Em andamento</option>
                    <option value="up_to_date">Concluido</option>
                  </select>
                </div>
                <div className="my-series-history-tools-right">
                  <span className="my-series-history-count">
                    {filteredSeriesHistory.length}/{seriesHistory.length} series
                  </span>
                  <div className="my-series-history-columns" ref={historyColumnsMenuRef}>
                    <button
                      type="button"
                      className="my-series-history-view-btn"
                      onClick={() => setIsHistoryColumnsMenuOpen((prev) => !prev)}
                      aria-expanded={isHistoryColumnsMenuOpen}
                    >
                      Visualizar
                    </button>
                    {isHistoryColumnsMenuOpen ? (
                      <div className="my-series-history-columns-menu" role="menu" aria-label="Colunas visiveis">
                        <p className="my-series-history-columns-title">Alternar colunas</p>
                        {(
                          [
                            ["image", "Imagem"],
                            ["status", "Status"],
                            ["pending", "Pendente"],
                            ["showStatus", "Status da serie"],
                            ["year", "Ano"],
                            ["timeSpent", "Tempo assistido"],
                            ["progress", "Progresso"],
                          ] as Array<[HistoryColumnKey, string]>
                        ).map(([key, label]) => (
                          <button
                            type="button"
                            key={key}
                            className={`my-series-history-columns-item${visibleHistoryColumns[key] ? " is-active" : ""}`}
                            onClick={() =>
                              setVisibleHistoryColumns((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                              }))
                            }
                          >
                            <span className="my-series-history-columns-check" aria-hidden="true">
                              {visibleHistoryColumns[key] ? "✓" : ""}
                            </span>
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              {!filteredSeriesHistory.length ? (
                <p className="subtitle my-series-done my-series-history-empty">Nenhuma serie encontrada para essa busca.</p>
              ) : null}
              {filteredSeriesHistory.length ? (
                <>
              <header className="my-series-completed-head">
                {visibleHistoryColumns.image ? <span>Imagem</span> : null}
                <button type="button" className="my-series-sort-head" onClick={() => toggleHistorySort("name")}>
                  Nome <span aria-hidden="true">{sortIndicator("name")}</span>
                </button>
                {visibleHistoryColumns.status ? (
                  <button type="button" className="my-series-sort-head" onClick={() => toggleHistorySort("status")}>
                    Status <span aria-hidden="true">{sortIndicator("status")}</span>
                  </button>
                ) : null}
                {visibleHistoryColumns.pending ? (
                  <button type="button" className="my-series-sort-head my-series-completed-head-pending" onClick={() => toggleHistorySort("pending")}>
                    Pendente <span aria-hidden="true">{sortIndicator("pending")}</span>
                  </button>
                ) : null}
                {visibleHistoryColumns.showStatus ? (
                  <button type="button" className="my-series-sort-head" onClick={() => toggleHistorySort("showStatus")}>
                    Status da serie <span aria-hidden="true">{sortIndicator("showStatus")}</span>
                  </button>
                ) : null}
                {visibleHistoryColumns.year ? (
                  <button type="button" className="my-series-sort-head" onClick={() => toggleHistorySort("year")}>
                    Ano <span aria-hidden="true">{sortIndicator("year")}</span>
                  </button>
                ) : null}
                {visibleHistoryColumns.timeSpent ? (
                  <button type="button" className="my-series-sort-head" onClick={() => toggleHistorySort("timeSpent")}>
                    Tempo assistido <span aria-hidden="true">{sortIndicator("timeSpent")}</span>
                  </button>
                ) : null}
                {visibleHistoryColumns.progress ? (
                  <button type="button" className="my-series-sort-head" onClick={() => toggleHistorySort("progress")}>
                    Progresso <span aria-hidden="true">{sortIndicator("progress")}</span>
                  </button>
                ) : null}
              </header>
              <div className="my-series-completed-list">
                {filteredSeriesHistory.map((series) => (
                  <article className="my-series-completed-row" key={series.id}>
                    {visibleHistoryColumns.image ? (
                      <Link
                        href={`/detalhe/serie/${series.id}`}
                        className="my-series-completed-image-link"
                        aria-label={`Abrir ${series.name}`}
                      >
                        {series.backdropUrl || series.posterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className="my-series-completed-image"
                            src={series.backdropUrl ?? series.posterUrl ?? ""}
                            alt={series.name}
                            loading="lazy"
                          />
                        ) : (
                          <div className="my-series-completed-image my-series-completed-image-empty" />
                        )}
                        {series.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="my-series-completed-image-logo" src={series.logoUrl} alt="" loading="lazy" />
                        ) : null}
                      </Link>
                    ) : null}
                    <Link
                      href={`/detalhe/serie/${series.id}`}
                      className="my-series-completed-main"
                      aria-label={`Abrir ${series.name}`}
                    >
                      <span className="my-series-completed-name">{series.name}</span>
                    </Link>
                    {visibleHistoryColumns.status ? (
                      <span className={`my-series-history-status is-${series.status}`}>
                        {series.status === "completed" ? "Concluido" : "Em andamento"}
                      </span>
                    ) : null}
                    {visibleHistoryColumns.pending ? (
                      <span className="my-series-history-pending">
                        {series.remainingEpisodes !== null ? series.remainingEpisodes : "-"}
                      </span>
                    ) : null}
                    {visibleHistoryColumns.showStatus ? (
                      <span className="my-series-completed-value">{showStatusLabel(series.showStatus)}</span>
                    ) : null}
                    {visibleHistoryColumns.year ? (
                      <span className="my-series-completed-value">
                        {series.firstAirDate?.slice(0, 4) || "-"}
                      </span>
                    ) : null}
                    {visibleHistoryColumns.timeSpent ? (
                      <span className="my-series-completed-value">
                        {series.watchedMinutes && series.watchedMinutes > 0 ? formatMinutes(series.watchedMinutes) : "n/d"}
                      </span>
                    ) : null}
                    {visibleHistoryColumns.progress ? (
                      <div className="my-series-completed-progress-wrap">
                        <div
                          className="my-series-completed-progress"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={series.progressPercent}
                        >
                          <span style={{ width: `${series.progressPercent}%` }} />
                        </div>
                        <span className="my-series-completed-percent">{series.progressPercent}%</span>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
                </>
              ) : null}
            </section>
          ) : null}

          {!isLoading && !errorMessage && viewMode === "stats" ? (
            <section className="my-series-stats-overview" aria-label="Resumo de series assistidas">
              <article className="my-series-stats-overview-card">
                <p className="my-series-stats-overview-label">Episodios vistos</p>
                <p className="my-series-stats-overview-value">{totalSeriesEpisodesWatched}</p>
              </article>
              <article className="my-series-stats-overview-card">
                <p className="my-series-stats-overview-label">Tempo em series</p>
                <p className="my-series-stats-overview-value">{formatMinutes(totalSeriesMinutesWatched)}</p>
              </article>
            </section>
          ) : null}

          {!isLoading && !errorMessage && viewMode === "movies" ? (
            <section className="my-series-stats-overview" aria-label="Resumo de filmes assistidos">
              <article className="my-series-stats-overview-card">
                <p className="my-series-stats-overview-label">Filmes vistos</p>
                <p className="my-series-stats-overview-value">{totalMoviesWatched}</p>
              </article>
              <article className="my-series-stats-overview-card">
                <p className="my-series-stats-overview-label">Tempo em filmes</p>
                <p className="my-series-stats-overview-value">{formatMinutes(totalMovieMinutesWatched)}</p>
              </article>
            </section>
          ) : null}

          {!isLoading && !errorMessage && viewMode === "stats" ? (
            <section className="my-series-stats-board" aria-label="Calendario de episodios vistos">
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

                    {day.totalViews > 0 ? (
                      <div className="my-series-stats-day-content">
                        <div className="my-series-stats-avatars">
                          {day.mediaKeys.map((mediaKey, index) => {
                            const [mediaType, rawId] = mediaKey.split(":");
                            const id = Number(rawId);
                            const poster =
                              mediaType === "movie"
                                ? moviePosterById.get(id) ?? null
                                : seriesPosterById.get(id) ?? null;
                            const label =
                              mediaType === "movie"
                                ? movieTitleById.get(id) ?? `Filme ${id}`
                                : seriesNameById.get(id) ?? `Serie ${id}`;
                            return (
                              <div
                                key={`${day.key}:${mediaKey}`}
                                className="my-series-stats-avatar"
                                style={{ transform: `translateX(${index * -9}px)`, zIndex: 10 - index }}
                                title={label}
                                aria-label={label}
                              >
                                {poster ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={poster} alt="" loading="lazy" />
                                ) : (
                                  <span className="my-series-stats-avatar-empty" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <p className="my-series-stats-episodes">{day.totalViews} vistos</p>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              <section className="my-series-heatmap" aria-label="Heatmap de episodios por dia">
                <div className="my-series-heatmap-grid">
                  {monthHeatmapDays.points.map((point) => {
                    const ratio =
                      monthHeatmapDays.maxViews > 0
                        ? Math.min(point.totalViews / monthHeatmapDays.maxViews, 1)
                        : 0;
                    const opacity = point.totalViews > 0 ? 0.2 + ratio * 0.8 : 0.08;
                    return (
                      <div
                        key={point.key}
                        className={`my-series-heatmap-cell${point.isCurrentMonth ? "" : " is-outside"}`}
                        style={{ backgroundColor: `rgba(141, 12, 10, ${opacity.toFixed(3)})` }}
                        data-tooltip={`${new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date(`${point.key}T00:00:00`))} - ${point.totalViews} visto(s)`}
                        aria-label={`${point.key}: ${point.totalViews} vistos`}
                      >
                        <span className="my-series-heatmap-day">{point.date.getDate()}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
