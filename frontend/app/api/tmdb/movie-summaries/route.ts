import { NextRequest, NextResponse } from "next/server";

type TmdbMovieDetail = {
  id: number;
  title?: string;
  poster_path: string | null;
  runtime?: number;
};

type MovieSummary = {
  id: number;
  title: string;
  posterUrl: string | null;
  runtime: number | null;
};

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_POSTER_URL = "https://image.tmdb.org/t/p/w500";

function parseIds(raw: string): number[] {
  return raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
    .slice(0, 40);
}

async function fetchMovieSummary(id: number): Promise<MovieSummary | null> {
  if (!TMDB_API_KEY) return null;

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: "pt-BR",
  });

  const response = await fetch(`${TMDB_BASE_URL}/movie/${id}?${params.toString()}`, {
    next: { revalidate: 1800 },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as TmdbMovieDetail;
  return {
    id: data.id,
    title: data.title || `Filme ${id}`,
    posterUrl: data.poster_path ? `${TMDB_POSTER_URL}${data.poster_path}` : null,
    runtime: typeof data.runtime === "number" && data.runtime > 0 ? data.runtime : null,
  };
}

export async function GET(request: NextRequest) {
  const idsRaw = request.nextUrl.searchParams.get("ids") || "";
  const ids = parseIds(idsRaw);

  if (!ids.length) {
    return NextResponse.json([], { status: 200 });
  }

  const summaries = await Promise.all(ids.map((id) => fetchMovieSummary(id)));
  const filtered = summaries.filter((item): item is MovieSummary => Boolean(item));

  return NextResponse.json(filtered, { status: 200 });
}
