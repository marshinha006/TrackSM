"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "../lib/api-base-url";

type StoredAuth = {
  id?: number;
};

type WatchedItem = {
  seasonNumber: number;
  episodeNumber: number;
  watchedAt?: string;
};

type MovieWatchToggleProps = {
  tmdbId: string;
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

export default function MovieWatchToggle({ tmdbId }: MovieWatchToggleProps) {
  const [userId, setUserId] = useState<number | null>(null);
  const [movieWatched, setMovieWatched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [watchedDate, setWatchedDate] = useState<string>(getTodayValue());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [calendarMonthStart, setCalendarMonthStart] = useState<Date>(() => startOfMonth(new Date()));

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
        const movieEntry = data.find((item) => item.seasonNumber === 0 && item.episodeNumber === 0);
        setMovieWatched(Boolean(movieEntry));
        const savedDate = watchedAtToDateValue(movieEntry?.watchedAt);
        if (savedDate) {
          setWatchedDate(savedDate);
        }
      } catch {
        // noop
      }
    }

    void loadWatched();
  }, [userId, tmdbId]);

  useEffect(() => {
    if (!isDatePickerOpen) return;

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-movie-date-picker="true"]')) return;
      setIsDatePickerOpen(false);
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDatePickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isDatePickerOpen]);

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
          watchedAt: watchedDate,
        }),
      });
      if (!response.ok) return;
      setMovieWatched((prev) => !prev);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveMovieWatchedAt(value: string) {
    if (!userId || isLoading) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/watched`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          mediaType: "movie",
          tmdbId: Number(tmdbId),
          seasonNumber: 0,
          episodeNumber: 0,
          watchedAt: value,
        }),
      });
      if (!response.ok) return;
      setMovieWatched(true);
    } finally {
      setIsLoading(false);
    }
  }

  function openDatePicker() {
    if (!userId || isLoading) return;
    setCalendarMonthStart(startOfMonth(fromDateValue(watchedDate)));
    setIsDatePickerOpen((prev) => !prev);
  }

  function selectDate(value: string) {
    if (!value) return;
    const today = getTodayValue();
    const nextValue = value > today ? today : value;
    setWatchedDate(nextValue);
    void saveMovieWatchedAt(nextValue);
    setIsDatePickerOpen(false);
  }

  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(calendarMonthStart);
  const days = buildCalendarDays(calendarMonthStart);
  const selectedDate = fromDateValue(watchedDate);
  const todayDate = fromDateValue(getTodayValue());

  return (
    <div className="detail-side-watch">
      <label className="watched-date-field">
        <span>Data</span>
        <div className="watched-date-control">
          <input
            type="date"
            className="watched-date-input"
            value={watchedDate}
            onChange={(event) => selectDate(event.target.value)}
            max={getTodayValue()}
            disabled={!userId || isLoading}
          />
          <div className="episode-date-picker movie-date-picker" data-movie-date-picker="true">
            <button
              type="button"
              className="episode-date-trigger"
              aria-label="Selecionar data vista"
              title="Selecionar data vista"
              onClick={openDatePicker}
              disabled={!userId || isLoading}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
                <path d="M7 3.5v3M17 3.5v3M3.5 9.5h17M8 13h3M13 13h3M8 17h3" />
              </svg>
            </button>
            {isDatePickerOpen ? (
              <div className="episode-date-popover movie-date-popover" data-movie-date-picker="true">
                <div className="episode-calendar-head">
                  <button
                    type="button"
                    className="episode-calendar-nav"
                    onClick={() =>
                      setCalendarMonthStart(
                        new Date(calendarMonthStart.getFullYear(), calendarMonthStart.getMonth() - 1, 1, 12, 0, 0, 0),
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
                        new Date(calendarMonthStart.getFullYear(), calendarMonthStart.getMonth() + 1, 1, 12, 0, 0, 0),
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
                      onClick={() => selectDate(day.dateValue)}
                    >
                      {day.date.getDate()}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </label>
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
