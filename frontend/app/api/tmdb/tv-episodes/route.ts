import { NextRequest, NextResponse } from "next/server";

type TmdbSeasonRef = {
  season_number: number;
};

type TmdbTvDetail = {
  seasons?: TmdbSeasonRef[];
};

type TmdbEpisode = {
  episode_number: number;
  name?: string;
  air_date?: string;
  still_path?: string | null;
  overview?: string;
};

type TmdbSeasonDetail = {
  episodes?: TmdbEpisode[];
};

type TvEpisodeSummary = {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string | null;
  stillUrl: string | null;
  overview: string;
};

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_STILL_URL = "https://image.tmdb.org/t/p/w780";

function parseId(raw: string | null): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

export async function GET(request: NextRequest) {
  if (!TMDB_API_KEY) {
    return NextResponse.json({ error: "TMDB_API_KEY nao configurada." }, { status: 500 });
  }

  const id = parseId(request.nextUrl.searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "id invalido" }, { status: 400 });
  }

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: "pt-BR",
  });

  const tvResponse = await fetch(`${TMDB_BASE_URL}/tv/${id}?${params.toString()}`, {
    next: { revalidate: 3600 },
  });

  if (!tvResponse.ok) {
    return NextResponse.json([], { status: 200 });
  }

  const tvData = (await tvResponse.json()) as TmdbTvDetail;
  const seasons = (tvData.seasons ?? []).map((season) => season.season_number).filter((season) => season > 0).slice(0, 25);
  if (!seasons.length) {
    return NextResponse.json([], { status: 200 });
  }

  const seasonDetails = await Promise.all(
    seasons.map(async (seasonNumber) => {
      const seasonResponse = await fetch(`${TMDB_BASE_URL}/tv/${id}/season/${seasonNumber}?${params.toString()}`, {
        next: { revalidate: 3600 },
      });
      if (!seasonResponse.ok) return [] as TvEpisodeSummary[];

      const seasonData = (await seasonResponse.json()) as TmdbSeasonDetail;
      return (seasonData.episodes ?? [])
        .filter((episode) => episode.episode_number > 0)
        .map((episode) => ({
          seasonNumber,
          episodeNumber: episode.episode_number,
          name: episode.name?.trim() || `Episodio ${episode.episode_number}`,
          airDate: episode.air_date ?? null,
          stillUrl: episode.still_path ? `${TMDB_STILL_URL}${episode.still_path}` : null,
          overview: episode.overview ?? "",
        }));
    }),
  );

  const flattened = seasonDetails
    .flat()
    .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);

  return NextResponse.json(flattened, { status: 200 });
}
