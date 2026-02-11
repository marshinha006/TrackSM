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
};

type ActiveSection = "cast" | "watch" | null;

function roleLabel(character: string): "Dublagem" | "Atuacao" {
  const normalized = character.toLowerCase();
  return normalized.includes("voice") || normalized.includes("voz") ? "Dublagem" : "Atuacao";
}

export default function DetailMenuSections({ cast, mediaType, tmdbId }: DetailMenuSectionsProps) {
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);

  const castPreview = useMemo(() => cast.slice(0, 16), [cast]);
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
      </div>
    </section>
  );
}
