"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type SearchResult = {
  id: number;
  mediaType: "movie" | "tv" | "person";
  title: string;
  posterUrl: string | null;
  year: string;
  typeLabel: string;
  rank: number | null;
  episodes: number | null;
};

export default function NavSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const hasQuery = query.trim().length >= 2;
  const tableVisible = isOpen && (hasQuery || isLoading || error || results.length > 0);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!wrapperRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("click", handleOutsideClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  useEffect(() => {
    if (!hasQuery) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Falha na busca");
        const data = (await response.json()) as SearchResult[];
        setResults(data);
      } catch (fetchError) {
        if ((fetchError as Error).name !== "AbortError") {
          setError("Nao foi possivel buscar agora.");
          setResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, hasQuery]);

  const resultsCountText = useMemo(() => {
    if (isLoading) return "Buscando...";
    if (error) return error;
    if (!hasQuery) return "Digite ao menos 2 letras.";
    if (!results.length) return "Nenhum resultado.";
    return `${results.length} resultado(s).`;
  }, [isLoading, error, hasQuery, results.length]);

  return (
    <div className="nav-search" ref={wrapperRef}>
      <div className={`nav-search-input-wrap${isOpen ? " is-open" : ""}`}>
        <input
          ref={inputRef}
          className="nav-search-input"
          placeholder="Buscar filme, serie, ator ou diretor..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <button
        type="button"
        className="nav-search-toggle"
        aria-expanded={isOpen}
        aria-label="Abrir busca"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10.5 3.5a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm7.85 11.44 2.15 2.16-1.41 1.41-2.16-2.15 1.42-1.42Z" />
        </svg>
      </button>

      {tableVisible ? (
        <div className="nav-search-panel" role="dialog" aria-label="Resultados da busca">
          <div className="nav-search-status">{resultsCountText}</div>
          {results.length ? (
            <div className="nav-search-table-wrap">
              <table className="nav-search-table">
                <thead>
                  <tr>
                    <th>Ano</th>
                    <th></th>
                    <th>Titulo</th>
                    <th>Tipo</th>
                    <th>Rank</th>
                    <th>Eps</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((item) => (
                    <tr key={`${item.mediaType}:${item.id}`}>
                      <td>{item.year}</td>
                      <td>
                        {item.posterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="nav-search-poster" src={item.posterUrl} alt={item.title} loading="lazy" />
                        ) : (
                          <span className="nav-search-poster-empty" />
                        )}
                      </td>
                      <td>
                        <Link
                          href={
                            item.mediaType === "person"
                              ? `/pessoa/${item.id}?name=${encodeURIComponent(item.title)}`
                              : `/detalhe/${item.mediaType === "movie" ? "filme" : "serie"}/${item.id}`
                          }
                          className="nav-search-title-link"
                          onClick={() => setIsOpen(false)}
                        >
                          {item.title}
                        </Link>
                      </td>
                      <td>{item.typeLabel}</td>
                      <td>{item.rank ?? "-"}</td>
                      <td>{item.episodes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
