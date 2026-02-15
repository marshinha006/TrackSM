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
  job?: string;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
};

type PersonCombinedCredits = {
  cast?: CreditItem[];
  crew?: CreditItem[];
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

function roleText(item: CreditItem): string {
  const character = item.character?.trim() ?? "";
  const job = item.job?.trim() ?? "";
  const characterLower = character.toLowerCase();

  if (job) return job;
  if (!character) return "";
  if (characterLower === "self" || characterLower === "himself" || characterLower === "herself") {
    return "Participacao";
  }
  return character;
}

function renderCard(item: CreditItem) {
  const title = item.title ?? item.name ?? "Sem titulo";
  const fillPercent = Math.max(0, Math.min(100, (item.vote_average ?? 0) * 10));
  const role = roleText(item);

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
      <p className="person-credit-title">{title}</p>
      <p className="subtitle person-credit-meta">
        {formatYear(item)}{role ? ` - ${role}` : ""}
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
    const crew = data.crew ?? [];
    const merged = [...crew, ...cast];
    const uniqueByMedia = merged.reduce<Map<string, CreditItem>>((acc, item) => {
      const key = `${item.media_type}-${item.id}`;
      const existing = acc.get(key);
      if (!existing) {
        acc.set(key, item);
        return acc;
      }

      const existingHasJob = Boolean(existing.job?.trim());
      const currentHasJob = Boolean(item.job?.trim());
      if (!existingHasJob && currentHasJob) {
        acc.set(key, item);
      }
      return acc;
    }, new Map());
    const credits = Array.from(uniqueByMedia.values());

    const movies = credits
      .filter((item) => item.media_type === "movie")
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 24);

    const series = credits
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
