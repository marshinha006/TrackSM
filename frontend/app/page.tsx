type TmdbItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  vote_average: number;
};

type TmdbResponse = {
  results: TmdbItem[];
};

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";
const requestOptions: RequestInit = { next: { revalidate: 1800 } };

async function fetchPopular(path: "movie/popular" | "tv/popular"): Promise<TmdbItem[]> {
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
  return data.results.slice(0, 15);
}

function renderCard(item: TmdbItem) {
  const title = item.title ?? item.name ?? "Sem titulo";

  return (
    <article className="card" key={item.id}>
      {item.poster_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="poster" src={`${TMDB_IMAGE_URL}${item.poster_path}`} alt={`Poster de ${title}`} />
      ) : (
        <div className="poster" />
      )}
      <div className="rating-chip" aria-label={`Nota ${item.vote_average.toFixed(1)} de 10`}>
        IMDb {item.vote_average.toFixed(1)}
      </div>
    </article>
  );
}

export default async function HomePage() {
  try {
    const [popularMovies, popularSeries] = await Promise.all([
      fetchPopular("movie/popular"),
      fetchPopular("tv/popular"),
    ]);

    return (
      <main>
        <header className="header">
          <p className="subtitle">Filmes e series populares no momento.</p>
        </header>

        <section>
          <h2 className="section-title">Filmes populares</h2>
          <div className="grid">{popularMovies.map(renderCard)}</div>
        </section>

        <section>
          <h2 className="section-title">Series populares</h2>
          <div className="grid">{popularSeries.map(renderCard)}</div>
        </section>
      </main>
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
