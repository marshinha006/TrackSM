import Link from "next/link";

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

function toValidMediaType(value?: string): "movie" | "tv" | null {
  if (value === "movie" || value === "tv") return value;
  return null;
}

async function fetchByGenre(mediaType: "movie" | "tv", genreId: string): Promise<TmdbItem[]> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY nao configurada.");
  }

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: "pt-BR",
    page: "1",
    sort_by: "popularity.desc",
    with_genres: genreId,
  });

  const res = await fetch(`${TMDB_BASE_URL}/discover/${mediaType}?${params.toString()}`, {
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    throw new Error("Falha ao buscar conteudos por genero.");
  }

  const data = (await res.json()) as TmdbResponse;
  return data.results;
}

function renderCard(item: TmdbItem, mediaType: "movie" | "tv") {
  const title = item.title ?? item.name ?? "Sem titulo";
  const appMediaType = mediaType === "movie" ? "filme" : "serie";
  const fillPercent = Math.max(0, Math.min(100, item.vote_average * 10));

  return (
    <Link className="card-link" href={`/detalhe/${appMediaType}/${item.id}`} key={`${mediaType}-${item.id}`}>
      <article className="card">
        {item.poster_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="poster" src={`${TMDB_IMAGE_URL}${item.poster_path}`} alt={`Poster de ${title}`} />
        ) : (
          <div className="poster" />
        )}
        <div className="rating-chip" aria-label={`Nota ${item.vote_average.toFixed(1)} de 10`}>
          <span className="star-meter" aria-hidden="true">
            {"\u2605"}
            <span className="star-meter-fill" style={{ width: `${fillPercent}%` }}>
              {"\u2605"}
            </span>
          </span>
          Nota {item.vote_average.toFixed(1)}
        </div>
      </article>
    </Link>
  );
}

export default async function ExplorarPage({
  searchParams,
}: {
  searchParams: Promise<{ mediaType?: string; genreId?: string; genreName?: string }>;
}) {
  const { mediaType: mediaTypeRaw, genreId, genreName } = await searchParams;
  const mediaType = toValidMediaType(mediaTypeRaw);

  if (!mediaType || !genreId) {
    return (
      <main>
        <header className="header">
          <h1>Explorar</h1>
        </header>
        <p className="subtitle">Selecione um genero na pagina de detalhes para ver filmes ou series parecidos.</p>
      </main>
    );
  }

  const mediaLabel = mediaType === "movie" ? "Filmes" : "Series";

  try {
    const items = await fetchByGenre(mediaType, genreId);

    return (
      <main>
        <header className="header">
          <div>
            <h1>Explorar</h1>
            <p className="subtitle">
              {mediaLabel} com genero: <strong>{genreName || "Selecionado"}</strong>
            </p>
          </div>
          <Link className="detail-back" href="/">
            Voltar para home
          </Link>
        </header>

        {items.length ? (
          <section>
            <h2 className="section-title">Resultados parecidos</h2>
            <div className="grid">{items.slice(0, 20).map((item) => renderCard(item, mediaType))}</div>
          </section>
        ) : (
          <p>Nao encontramos resultados para este genero no momento.</p>
        )}
      </main>
    );
  } catch {
    return (
      <main>
        <header className="header">
          <h1>Explorar</h1>
        </header>
        <p>Nao foi possivel carregar os resultados por genero agora. Tente novamente em instantes.</p>
      </main>
    );
  }
}
