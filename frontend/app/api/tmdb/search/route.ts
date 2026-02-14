import { NextRequest, NextResponse } from "next/server";

type TmdbSearchItem = {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_count?: number;
};

type TmdbMediaItem = TmdbSearchItem & { media_type: "movie" | "tv" };

type TmdbSearchResponse = {
  results?: TmdbSearchItem[];
};

type TmdbTvDetail = {
  number_of_episodes?: number;
};

type SearchResult = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterUrl: string | null;
  year: string;
  typeLabel: string;
  rank: number | null;
  episodes: number | null;
};

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_POSTER_URL = "https://image.tmdb.org/t/p/w154";

function extractYear(item: TmdbSearchItem): string {
  const raw = item.media_type === "movie" ? item.release_date : item.first_air_date;
  if (!raw || raw.length < 4) return "-";
  return raw.slice(0, 4);
}

async function fetchTvEpisodesCount(tvId: number): Promise<number | null> {
  if (!TMDB_API_KEY) return null;
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: "pt-BR",
  });
  const response = await fetch(`${TMDB_BASE_URL}/tv/${tvId}?${params.toString()}`, {
    next: { revalidate: 1800 },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as TmdbTvDetail;
  return typeof data.number_of_episodes === "number" && data.number_of_episodes > 0 ? data.number_of_episodes : null;
}

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim();
  if (!query) return NextResponse.json([], { status: 200 });
  if (!TMDB_API_KEY) return NextResponse.json([], { status: 200 });

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: "pt-BR",
    query,
    include_adult: "false",
    page: "1",
  });

  const response = await fetch(`${TMDB_BASE_URL}/search/multi?${params.toString()}`, {
    next: { revalidate: 600 },
  });
  if (!response.ok) return NextResponse.json([], { status: 200 });

  const data = (await response.json()) as TmdbSearchResponse;
  const filtered = (data.results ?? [])
    .filter((item): item is TmdbMediaItem => item.media_type === "movie" || item.media_type === "tv")
    .slice(0, 14);

  const tvEpisodeMap = new Map<number, number | null>();
  await Promise.all(
    filtered
      .filter((item) => item.media_type === "tv")
      .map(async (item) => {
        tvEpisodeMap.set(item.id, await fetchTvEpisodesCount(item.id));
      }),
  );

  const out: SearchResult[] = filtered.map((item) => ({
    id: item.id,
    mediaType: item.media_type,
    title: item.title || item.name || `Item ${item.id}`,
    posterUrl: item.poster_path ? `${TMDB_POSTER_URL}${item.poster_path}` : null,
    year: extractYear(item),
    typeLabel: item.media_type === "movie" ? "Filme" : "Serie",
    rank: typeof item.vote_count === "number" ? item.vote_count : null,
    episodes: item.media_type === "tv" ? tvEpisodeMap.get(item.id) ?? null : null,
  }));

  return NextResponse.json(out, { status: 200 });
}
