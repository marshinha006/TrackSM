import RecentBannerCarousel from "./components/recent-banner-carousel";

type TmdbItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
};

type TmdbResponse = {
  results: TmdbItem[];
};

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

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";
const requestOptions: RequestInit = { next: { revalidate: 1800 } };

async function fetchTmdb(
  path: "movie/popular" | "tv/popular" | "movie/now_playing" | "tv/airing_today",
): Promise<TmdbItem[]> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY nao configurada.");
  }

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: "pt-BR",
    page: "1",
  });

  const res = await fetch(`${TMDB_BASE_URL}/${path}?${params.toString()}`, requestOptions);
  if (!res.ok) {
    throw new Error(`Falha ao buscar ${path}.`);
  }

  const data = (await res.json()) as TmdbResponse;
  return data.results;
}

function renderCard(item: TmdbItem) {
  const title = item.title ?? item.name ?? "Sem titulo";
  const fillPercent = Math.max(0, Math.min(100, item.vote_average * 10));

  return (
    <article className="card" key={item.id}>
      {item.poster_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="poster" src={`${TMDB_IMAGE_URL}${item.poster_path}`} alt={`Poster de ${title}`} />
      ) : (
        <div className="poster" />
      )}
      <div className="rating-chip" aria-label={`Nota ${item.vote_average.toFixed(1)} de 10`}>
        <span className="star-meter" aria-hidden="true">
          ★
          <span className="star-meter-fill" style={{ width: `${fillPercent}%` }}>
            ★
          </span>
        </span>
        Nota {item.vote_average.toFixed(1)}
      </div>
    </article>
  );
}

function toRecentItem(item: TmdbItem, mediaLabel: "Filme" | "Serie"): RecentItem {
  return {
    id: item.id,
    title: item.title ?? item.name ?? "Sem titulo",
    overview: item.overview ?? "",
    backdropPath: item.backdrop_path,
    posterPath: item.poster_path,
    voteAverage: item.vote_average,
    releaseDate: item.release_date ?? item.first_air_date ?? null,
    mediaLabel,
  };
}

function dateToValue(raw: string | null): number {
  if (!raw) return 0;
  const value = Date.parse(raw);
  return Number.isNaN(value) ? 0 : value;
}

export default async function HomePage() {
  try {
    const [popularMovies, popularSeries, recentMovies, recentSeries] = await Promise.all([
      fetchTmdb("movie/popular"),
      fetchTmdb("tv/popular"),
      fetchTmdb("movie/now_playing"),
      fetchTmdb("tv/airing_today"),
    ]);

    const recentItems = [
      ...recentMovies.map((item) => toRecentItem(item, "Filme")),
      ...recentSeries.map((item) => toRecentItem(item, "Serie")),
    ]
      .sort((a, b) => dateToValue(b.releaseDate) - dateToValue(a.releaseDate))
      .slice(0, 20);

    return (
      <>
        <RecentBannerCarousel items={recentItems} />

        <main>
          <header className="header">
            <p className="subtitle">Filmes e series populares no momento.</p>
          </header>

          <section>
            <h2 className="section-title">Filmes populares</h2>
            <div className="grid">{popularMovies.slice(0, 15).map(renderCard)}</div>
          </section>

          <section>
            <h2 className="section-title">Series populares</h2>
            <div className="grid">{popularSeries.slice(0, 15).map(renderCard)}</div>
          </section>
        </main>
      </>
    );
  } catch {
    return (
      <main>
        <header className="header">
          <p className="subtitle">Filmes e series populares no momento.</p>
        </header>

        <p>Nao foi possivel carregar os dados da TMDB agora. Tente novamente em instantes.</p>
      </main>
    );
  }
}
