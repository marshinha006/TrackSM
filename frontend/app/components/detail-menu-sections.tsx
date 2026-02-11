"use client";

import { useEffect, useMemo, useState } from "react";

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
            Assistir
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
                      {selectedSeason.episodes.map((episode) => (
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
                          </div>
                        </li>
                      ))}
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
    </section>
  );
}
