import Link from "next/link";
import { notFound } from "next/navigation";
import DetailScrollLock from "./detail-scroll-lock";
import DetailMenuSections from "./detail-menu-sections";
import MovieWatchToggle from "./movie-watch-toggle";

type DetailGenre = {
  id: number;
  name: string;
};

type TmdbDetail = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date?: string;
  first_air_date?: string;
  genres?: DetailGenre[];
  status?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  videos?: {
    results?: TmdbVideo[];
  };
  credits?: {
    cast?: TmdbCast[];
  };
  seasons?: TmdbSeasonSummary[];
};

type TmdbVideo = {
  key: string;
  name: string;
  site: string;
  type: string;
  official?: boolean;
};

type TmdbCast = {
  id: number;
  name: string;
  character?: string;
  profile_path: string | null;
};

type TmdbSeasonSummary = {
  season_number: number;
  name: string;
  episode_count: number;
};

type TmdbSeasonDetail = {
  id: number;
  season_number: number;
  name: string;
  episodes?: TmdbEpisode[];
};

type TmdbEpisode = {
  id: number;
  name: string;
  episode_number: number;
  air_date?: string;
  still_path: string | null;
  overview?: string;
  runtime?: number;
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
    runtime?: number;
  }[];
};

type TmdbProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
};

type TmdbProviderRegion = {
  flatrate?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
};

type TmdbWatchProvidersResponse = {
  results?: Record<string, TmdbProviderRegion>;
};

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP_URL = "https://image.tmdb.org/t/p/original";
const TMDB_LOGO_URL = "https://image.tmdb.org/t/p/w92";
const TMDB_PROFILE_URL = "https://image.tmdb.org/t/p/w185";
const TMDB_STILL_URL = "https://image.tmdb.org/t/p/w500";

function toTmdbMedia(mediaTypeParam: string): "movie" | "tv" | null {
  if (mediaTypeParam === "filme") return "movie";
  if (mediaTypeParam === "serie") return "tv";
  return null;
}

function formatDate(value?: string): string {
  if (!value) return "Data indisponivel";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatRuntime(data: TmdbDetail, isMovie: boolean): string {
  if (isMovie) {
    if (!data.runtime) return "Duracao indisponivel";
    const h = Math.floor(data.runtime / 60);
    const m = data.runtime % 60;
    return `${h}h ${m}m`;
  }

  const episodeMinutes = data.episode_run_time?.[0];
  if (!episodeMinutes) return "Duracao por episodio indisponivel";
  return `${episodeMinutes} min por episodio`;
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${hours}h ${minutes}m`;
}

function formatSeriesRuntime(data: TmdbDetail, seasons: SeasonPanelData[]): string {
  const episodeMinutes = data.episode_run_time?.[0];
  const episodeCount = data.number_of_episodes ?? 0;

  if (episodeMinutes && episodeCount > 0) {
    return `${formatMinutes(episodeMinutes * episodeCount)} total`;
  }

  const summedRuntime = seasons
    .flatMap((season) => season.episodes)
    .reduce((acc, episode) => acc + (episode.runtime ?? 0), 0);

  if (summedRuntime > 0) {
    return `${formatMinutes(summedRuntime)} total`;
  }

  if (episodeMinutes) {
    return `${episodeMinutes} min por episodio`;
  }

  return "Duracao indisponivel";
}

async function fetchDetail(tmdbMediaType: "movie" | "tv", id: string): Promise<TmdbDetail> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY nao configurada.");
  }

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: "pt-BR",
    append_to_response: "videos,credits",
  });

  const res = await fetch(`${TMDB_BASE_URL}/${tmdbMediaType}/${id}?${params.toString()}`, {
    next: { revalidate: 1800 },
  });

  if (res.status === 404) {
    notFound();
  }

  if (!res.ok) {
    throw new Error("Falha ao carregar detalhes da TMDB.");
  }

  return (await res.json()) as TmdbDetail;
}

async function fetchWatchProviders(tmdbMediaType: "movie" | "tv", id: string): Promise<TmdbWatchProvidersResponse> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY nao configurada.");
  }

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
  });

  const res = await fetch(`${TMDB_BASE_URL}/${tmdbMediaType}/${id}/watch/providers?${params.toString()}`, {
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    return {};
  }

  return (await res.json()) as TmdbWatchProvidersResponse;
}

async function fetchTvSeasons(tvId: string, seasons: TmdbSeasonSummary[] | undefined): Promise<SeasonPanelData[]> {
  if (!TMDB_API_KEY || !seasons?.length) {
    return [];
  }

  const validSeasons = seasons.filter((season) => season.season_number > 0).slice(0, 20);
  if (!validSeasons.length) return [];

  const details = await Promise.all(
    validSeasons.map(async (season) => {
      const params = new URLSearchParams({
        api_key: TMDB_API_KEY,
        language: "pt-BR",
      });

      const res = await fetch(`${TMDB_BASE_URL}/tv/${tvId}/season/${season.season_number}?${params.toString()}`, {
        next: { revalidate: 1800 },
      });

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as TmdbSeasonDetail;
      return {
        seasonNumber: season.season_number,
        seasonName: data.name || season.name || `Temporada ${season.season_number}`,
        episodeCount: season.episode_count ?? data.episodes?.length ?? 0,
        episodes:
          data.episodes?.map((episode) => ({
            id: episode.id,
            name: episode.name || `Episodio ${episode.episode_number}`,
            episodeNumber: episode.episode_number,
            airDate: episode.air_date,
            stillUrl: episode.still_path ? `${TMDB_STILL_URL}${episode.still_path}` : null,
            overview: episode.overview ?? "",
            runtime: episode.runtime,
          })) ?? [],
      } satisfies SeasonPanelData;
    }),
  );

  return details.reduce<SeasonPanelData[]>((acc, item) => {
    if (item) acc.push(item);
    return acc;
  }, []);
}

function selectTrailerKey(videos: TmdbVideo[] | undefined): string | null {
  if (!videos?.length) return null;

  const youtubeVideos = videos.filter((video) => video.site === "YouTube" && video.key);
  if (!youtubeVideos.length) return null;

  const officialTrailer = youtubeVideos.find((video) => video.type === "Trailer" && video.official);
  if (officialTrailer) return officialTrailer.key;

  const anyTrailer = youtubeVideos.find((video) => video.type === "Trailer");
  if (anyTrailer) return anyTrailer.key;

  return youtubeVideos[0].key;
}

function pickStreamingProviders(data: TmdbWatchProvidersResponse): TmdbProvider[] {
  const regions = data.results ?? {};
  const preferredRegions = ["BR", "US"];

  for (const region of preferredRegions) {
    const source = regions[region];
    if (!source) continue;

    const grouped = [...(source.flatrate ?? []), ...(source.rent ?? []), ...(source.buy ?? [])];
    if (!grouped.length) continue;

    const seen = new Set<number>();
    return grouped
      .filter((provider) => {
        if (seen.has(provider.provider_id) || !provider.logo_path) return false;
        seen.add(provider.provider_id);
        return true;
      })
      .slice(0, 8);
  }

  return [];
}

export default async function DetailPage({ params }: { params: Promise<{ mediaType: string; id: string }> }) {
  const { mediaType, id } = await params;
  const tmdbMediaType = toTmdbMedia(mediaType);

  if (!tmdbMediaType) {
    notFound();
  }

  const [detail, watchProvidersData] = await Promise.all([
    fetchDetail(tmdbMediaType, id),
    fetchWatchProviders(tmdbMediaType, id),
  ]);

  const title = detail.title ?? detail.name ?? "Sem titulo";
  const originalTitle = detail.original_title ?? detail.original_name ?? "";
  const isMovie = tmdbMediaType === "movie";
  const releaseDate = isMovie ? detail.release_date : detail.first_air_date;
  const genres = detail.genres ?? [];
  const fillPercent = Math.max(0, Math.min(100, detail.vote_average * 10));
  const trailerKey = isMovie ? selectTrailerKey(detail.videos?.results) : null;
  const streamingProviders = isMovie ? pickStreamingProviders(watchProvidersData) : [];
  const castMembers = detail.credits?.cast?.map((person) => ({
    id: person.id,
    name: person.name,
    character: person.character ?? "",
    profileUrl: person.profile_path ? `${TMDB_PROFILE_URL}${person.profile_path}` : null,
  })) ?? [];
  const seasonsData = !isMovie ? await fetchTvSeasons(id, detail.seasons) : [];
  const runtimeText = isMovie ? formatRuntime(detail, true) : formatSeriesRuntime(detail, seasonsData);

  return (
    <main className="detail-page">
      <DetailScrollLock />

      <Link className="detail-back" href="/">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M15 6 L9 12 L15 18" />
        </svg>
        <span>Voltar</span>
      </Link>

      <section
        className="detail-hero"
        style={
          detail.backdrop_path
            ? {
                backgroundImage: `linear-gradient(110deg, rgba(4, 6, 14, 0.88), rgba(4, 6, 14, 0.5)), url(${TMDB_BACKDROP_URL}${detail.backdrop_path})`,
              }
            : undefined
        }
      >
        <div className="detail-content">
          <div className="detail-poster-column">
            {detail.poster_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="detail-poster" src={`${TMDB_IMAGE_URL}${detail.poster_path}`} alt={`Poster de ${title}`} />
            ) : (
              <div className="detail-poster detail-poster-empty" />
            )}
            {isMovie ? <MovieWatchToggle tmdbId={id} /> : null}
          </div>

          <div className="detail-info">
            <p className="detail-type">{isMovie ? "Filme" : "Serie"}</p>
            <h1 className="detail-title">{title}</h1>
            {originalTitle && originalTitle !== title ? <p className="detail-original">Titulo original: {originalTitle}</p> : null}

            <p className="detail-meta">
              {formatDate(releaseDate)} - {runtimeText}
            </p>

            {genres.length ? (
              <div className="detail-genre-tags" aria-label="Generos">
                {genres.map((genre) => (
                  <Link
                    key={genre.id}
                    className="genre-chip"
                    href={`/explorar?mediaType=${tmdbMediaType}&genreId=${genre.id}&genreName=${encodeURIComponent(genre.name)}`}
                  >
                    {genre.name}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="detail-extra">Genero indisponivel</p>
            )}

            <p className="detail-rating">
              <span className="star-meter" aria-hidden="true">
                {"\u2605"}
                <span className="star-meter-fill" style={{ width: `${fillPercent}%` }}>
                  {"\u2605"}
                </span>
              </span>
              Nota {detail.vote_average.toFixed(1)} ({detail.vote_count.toLocaleString("pt-BR")} votos)
            </p>

            <p className="detail-overview">{detail.overview?.trim() || "Sinopse indisponivel."}</p>

            {isMovie && trailerKey ? (
              <div className="detail-trailer">
                <div className="detail-trailer-frame">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${trailerKey}`}
                    title={`Trailer de ${title}`}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : null}

            {!isMovie ? (
              <p className="detail-extra">
                {detail.number_of_seasons ?? 0} temporada(s) - {detail.number_of_episodes ?? 0} episodio(s)
              </p>
            ) : null}

            {!isMovie && detail.status ? <p className="detail-extra">Status: {detail.status}</p> : null}
          </div>

          {isMovie ? (
            <aside className="detail-streaming" aria-label="Onde assistir">
              {streamingProviders.map((provider) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={provider.provider_id}
                  className="detail-streaming-logo"
                  src={`${TMDB_LOGO_URL}${provider.logo_path}`}
                  alt={provider.provider_name}
                  title={provider.provider_name}
                  loading="lazy"
                />
              ))}
            </aside>
          ) : null}
        </div>
      </section>

      <DetailMenuSections cast={castMembers} mediaType={tmdbMediaType} tmdbId={id} seasons={seasonsData} />
    </main>
  );
}
