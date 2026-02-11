"use client";

import { useEffect, useMemo, useState } from "react";

type RecentItem = {
  id: number;
  title: string;
  overview: string;
  backdropPath: string | null;
  posterPath: string | null;
  voteAverage: number;
  releaseDate: string | null;
  mediaLabel: "Filme" | "Serie";
};

type RecentBannerCarouselProps = {
  items: RecentItem[];
};

const TMDB_BACKDROP_URL = "https://image.tmdb.org/t/p/original";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";

function formatDate(value: string | null): string {
  if (!value) return "Data indisponivel";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default function RecentBannerCarousel({ items }: RecentBannerCarouselProps) {
  const safeItems = useMemo(() => items.filter((item) => item.backdropPath || item.posterPath), [items]);
  const total = safeItems.length;
  const [displayIndex, setDisplayIndex] = useState(1);
  const [isAnimating, setIsAnimating] = useState(true);

  const slides = useMemo(() => {
    if (total === 0) return [];
    return [safeItems[total - 1], ...safeItems, safeItems[0]];
  }, [safeItems, total]);
  const activeIndex = ((displayIndex - 1) % total + total) % total;

  useEffect(() => {
    setDisplayIndex(1);
  }, [total]);

  useEffect(() => {
    if (isAnimating) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsAnimating(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [isAnimating]);

  if (total === 0) return null;

  function goPrev() {
    if (total <= 1) return;
    setIsAnimating(true);
    setDisplayIndex((prev) => prev - 1);
  }

  function goNext() {
    if (total <= 1) return;
    setIsAnimating(true);
    setDisplayIndex((prev) => prev + 1);
  }

  useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(() => {
      setIsAnimating(true);
      setDisplayIndex((prev) => prev + 1);
    }, 7000);

    return () => clearInterval(timer);
  }, [total]);

  function handleTransitionEnd() {
    if (displayIndex === 0) {
      setIsAnimating(false);
      setDisplayIndex(total);
      return;
    }

    if (displayIndex === total + 1) {
      setIsAnimating(false);
      setDisplayIndex(1);
    }
  }

  return (
    <section className="recent-carousel" aria-label="Banner de lancamentos recentes">
      <button type="button" className="carousel-arrow left" onClick={goPrev} aria-label="Anterior">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M15 6 L9 12 L15 18" />
        </svg>
      </button>

      <div className="recent-carousel-viewport">
        <div
          className="recent-carousel-track"
          style={{
            transform: `translateX(-${displayIndex * 100}%)`,
            transition: isAnimating ? "transform 480ms cubic-bezier(0.22, 0.61, 0.36, 1)" : "none",
          }}
          onTransitionEnd={handleTransitionEnd}
          aria-live="polite"
        >
          {slides.map((item, idx) => {
            const image = item.backdropPath ?? item.posterPath;
            const imageUrl = image ? `${TMDB_BACKDROP_URL}${image}` : undefined;
            const thumbUrl = item.posterPath ? `${TMDB_IMAGE_URL}${item.posterPath}` : imageUrl;
            const overviewText =
              item.overview?.trim() || "Acompanhe os lancamentos mais recentes de filmes e series direto da TMDB.";
            const fillPercent = Math.max(0, Math.min(100, item.voteAverage * 10));

            return (
              <div
                className="recent-carousel-slide"
                key={`${item.mediaLabel}-${item.id}-${idx}`}
                style={
                  imageUrl
                    ? {
                        backgroundImage: `linear-gradient(110deg, rgba(4, 6, 14, 0.86), rgba(4, 6, 14, 0.45)), url(${imageUrl})`,
                      }
                    : undefined
                }
              >
                <div className="recent-carousel-content">
                  <p className="recent-kicker">Novidades da semana</p>
                  <h2 className="recent-title">Recem lançados</h2>
                  <article className="recent-feature">
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="recent-feature-thumb" src={thumbUrl} alt={`Capa de ${item.title}`} />
                    ) : (
                      <div className="recent-feature-thumb recent-feature-thumb-empty" />
                    )}
                    <div>
                      <p className="recent-label">{item.mediaLabel}</p>
                      <h3 className="recent-item-title">{item.title}</h3>
                      <p className="recent-description">{overviewText}</p>
                      <p className="recent-item-meta">
                        {formatDate(item.releaseDate)} -{" "}
                        <span className="star-meter" aria-hidden="true">
                          {"\u2605"}
                          <span className="star-meter-fill" style={{ width: `${fillPercent}%` }}>
                            {"\u2605"}
                          </span>
                        </span>{" "}
                        Nota {item.voteAverage.toFixed(1)}
                      </p>
                    </div>
                  </article>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button type="button" className="carousel-arrow right" onClick={goNext} aria-label="Proximo">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 6 L15 12 L9 18" />
        </svg>
      </button>

      <div className="carousel-dots" aria-label="Indicadores do carrossel">
        {safeItems.map((item, idx) => (
          <button
            key={`dot-${item.mediaLabel}-${item.id}-${idx}`}
            type="button"
            className={`carousel-dot${idx === activeIndex ? " is-active" : ""}`}
            onClick={() => {
              setIsAnimating(true);
              setDisplayIndex(idx + 1);
            }}
            aria-label={`Ir para item ${idx + 1}`}
            aria-pressed={idx === activeIndex}
          />
        ))}
      </div>
    </section>
  );
}
