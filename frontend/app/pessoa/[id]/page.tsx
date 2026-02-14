import Link from "next/link";
import { notFound } from "next/navigation";

type CreditItem = {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path: string | null;
  vote_average?: number;
  character?: string;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
};

type PersonCombinedCredits = {
  cast?: CreditItem[];
};

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";

function formatYear(item: CreditItem): string {
  const raw = item.media_type === "movie" ? item.release_date : item.first_air_date;
  if (!raw || raw.length < 4) return "Ano n/d";
  return raw.slice(0, 4);
}

function toAppMediaType(mediaType: "movie" | "tv"): "filme" | "serie" {
  return mediaType === "movie" ? "filme" : "serie";
}

function renderCard(item: CreditItem) {
  const title = item.title ?? item.name ?? "Sem titulo";
  const fillPercent = Math.max(0, Math.min(100, (item.vote_average ?? 0) * 10));

  return (
    <Link className="card-link" href={`/detalhe/${toAppMediaType(item.media_type)}/${item.id}`} key={`${item.media_type}-${item.id}`}>
      <article className="card">
        {item.poster_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="poster" src={`${TMDB_IMAGE_URL}${item.poster_path}`} alt={`Poster de ${title}`} />
        ) : (
          <div className="poster" />
        )}
        <div className="rating-chip" aria-label={`Nota ${(item.vote_average ?? 0).toFixed(1)} de 10`}>
          <span className="star-meter" aria-hidden="true">
            {"\u2605"}
            <span className="star-meter-fill" style={{ width: `${fillPercent}%` }}>
              {"\u2605"}
            </span>
          </span>
          Nota {(item.vote_average ?? 0).toFixed(1)}
        </div>
      </article>
      <p className="subtitle" style={{ marginTop: "0.35rem" }}>
        {formatYear(item)}{item.character ? ` - ${item.character}` : ""}
      </p>
    </Link>
  );
}

async function fetchPersonCredits(id: string): Promise<PersonCombinedCredits> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY nao configurada.");
  }

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: "pt-BR",
  });

  const response = await fetch(`${TMDB_BASE_URL}/person/${id}/combined_credits?${params.toString()}`, {
    next: { revalidate: 1800 },
  });

  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error("Falha ao carregar creditos da pessoa.");
  }

  return (await response.json()) as PersonCombinedCredits;
}

export default async function PessoaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string }>;
}) {
  const { id } = await params;
  const { name } = await searchParams;

  try {
    const data = await fetchPersonCredits(id);
    const cast = data.cast ?? [];

    const movies = cast
      .filter((item) => item.media_type === "movie")
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 24);

    const series = cast
      .filter((item) => item.media_type === "tv")
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 24);

    return (
      <main>
        <header className="header">
          <div>
            <h1>{name ? `Elenco: ${name}` : "Trabalhos do elenco"}</h1>
            <p className="subtitle">Filmes e series em que essa pessoa participou.</p>
          </div>
          <Link className="detail-back" href="/">
            Voltar para home
          </Link>
        </header>

        {movies.length ? (
          <section>
            <h2 className="section-title">Filmes</h2>
            <div className="grid">{movies.map((item) => renderCard(item))}</div>
          </section>
        ) : null}

        {series.length ? (
          <section>
            <h2 className="section-title">Series</h2>
            <div className="grid">{series.map((item) => renderCard(item))}</div>
          </section>
        ) : null}

        {!movies.length && !series.length ? <p className="subtitle">Nenhum trabalho encontrado no momento.</p> : null}
      </main>
    );
  } catch {
    return (
      <main>
        <header className="header">
          <h1>{name ? `Elenco: ${name}` : "Trabalhos do elenco"}</h1>
        </header>
        <p>Nao foi possivel carregar os trabalhos dessa pessoa agora. Tente novamente em instantes.</p>
      </main>
    );
  }
}
