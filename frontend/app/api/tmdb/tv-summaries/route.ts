import { NextRequest, NextResponse } from "next/server";

type TmdbTvDetail = {
  id: number;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  status?: string;
  first_air_date?: string;
  number_of_episodes?: number;
  episode_run_time?: number[];
  last_episode_to_air?: {
    runtime?: number;
  };
  images?: {
    logos?: { file_path: string; iso_639_1: string | null; vote_average?: number }[];
  };
};

type TvSummary = {
  id: number;
  name: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  logoUrl: string | null;
  showStatus: string | null;
  firstAirDate: string | null;
  totalEpisodes: number | null;
  averageEpisodeRuntime: number | null;
};

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_POSTER_URL = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP_URL = "https://image.tmdb.org/t/p/w1280";
const TMDB_LOGO_URL = "https://image.tmdb.org/t/p/w500";

function parseIds(raw: string): number[] {
  return raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
    .slice(0, 40);
}

async function fetchTvSummary(id: number): Promise<TvSummary | null> {
  if (!TMDB_API_KEY) return null;

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: "pt-BR",
    append_to_response: "images",
    include_image_language: "pt,null,en",
  });

  const response = await fetch(`${TMDB_BASE_URL}/tv/${id}?${params.toString()}`, {
    next: { revalidate: 1800 },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as TmdbTvDetail;
  const logos = data.images?.logos ?? [];
  const preferredLogo =
    logos.find((logo) => logo.iso_639_1 === "pt") ??
    logos.find((logo) => logo.iso_639_1 === null) ??
    logos.find((logo) => logo.iso_639_1 === "en") ??
    logos[0];

  return {
    id: data.id,
    name: data.name || `Serie ${id}`,
    posterUrl: data.poster_path ? `${TMDB_POSTER_URL}${data.poster_path}` : null,
    backdropUrl: data.backdrop_path ? `${TMDB_BACKDROP_URL}${data.backdrop_path}` : null,
    logoUrl: preferredLogo?.file_path ? `${TMDB_LOGO_URL}${preferredLogo.file_path}` : null,
    showStatus: data.status ?? null,
    firstAirDate: data.first_air_date ?? null,
    totalEpisodes: typeof data.number_of_episodes === "number" && data.number_of_episodes > 0 ? data.number_of_episodes : null,
    averageEpisodeRuntime:
      typeof data.episode_run_time?.[0] === "number" && data.episode_run_time[0] > 0
        ? data.episode_run_time[0]
        : typeof data.last_episode_to_air?.runtime === "number" && data.last_episode_to_air.runtime > 0
          ? data.last_episode_to_air.runtime
          : null,
  };
}

export async function GET(request: NextRequest) {
  const idsRaw = request.nextUrl.searchParams.get("ids") || "";
  const ids = parseIds(idsRaw);

  if (!ids.length) {
    return NextResponse.json([], { status: 200 });
  }

  const summaries = await Promise.all(ids.map((id) => fetchTvSummary(id)));
  const filtered = summaries.filter((item): item is TvSummary => Boolean(item));

  return NextResponse.json(filtered, { status: 200 });
}
