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

function isGenericEpisodeTitle(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return /^epis[oó]dio\s+\d+$/.test(normalized) || /^episode\s+\d+$/.test(normalized);
}

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

  const paramsPt = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: "pt-BR",
  });
  const paramsEn = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: "en-US",
  });

  const tvResponse = await fetch(`${TMDB_BASE_URL}/tv/${id}?${paramsPt.toString()}`, {
    next: { revalidate: 3600 },
  });

  if (!tvResponse.ok) {
    return NextResponse.json([], { status: 200 });
  }

  const tvData = (await tvResponse.json()) as TmdbTvDetail;
  const seasons = (tvData.seasons ?? [])
    .map((season) => season.season_number)
    .filter((season) => season > 0);
  if (!seasons.length) {
    return NextResponse.json([], { status: 200 });
  }

  const seasonDetails = await Promise.all(
    seasons.map(async (seasonNumber) => {
      const [seasonPtResponse, seasonEnResponse] = await Promise.all([
        fetch(`${TMDB_BASE_URL}/tv/${id}/season/${seasonNumber}?${paramsPt.toString()}`, {
          next: { revalidate: 3600 },
        }),
        fetch(`${TMDB_BASE_URL}/tv/${id}/season/${seasonNumber}?${paramsEn.toString()}`, {
          next: { revalidate: 3600 },
        }),
      ]);

      if (!seasonPtResponse.ok && !seasonEnResponse.ok) return [] as TvEpisodeSummary[];

      const seasonPtData = seasonPtResponse.ok
        ? ((await seasonPtResponse.json()) as TmdbSeasonDetail)
        : ({ episodes: [] } as TmdbSeasonDetail);
      const seasonEnData = seasonEnResponse.ok
        ? ((await seasonEnResponse.json()) as TmdbSeasonDetail)
        : ({ episodes: [] } as TmdbSeasonDetail);

      const enNameByEpisode = new Map<number, string>(
        (seasonEnData.episodes ?? [])
          .filter((episode) => episode.episode_number > 0)
          .map((episode) => [episode.episode_number, episode.name?.trim() || ""]),
      );

      return (seasonPtData.episodes ?? [])
        .filter((episode) => episode.episode_number > 0)
        .map((episode) => {
          const ptName = episode.name?.trim() || "";
          const enName = enNameByEpisode.get(episode.episode_number) || "";
          const resolvedName =
            !ptName || isGenericEpisodeTitle(ptName)
              ? enName && !isGenericEpisodeTitle(enName)
                ? enName
                : ptName || enName
              : ptName;
          return {
            seasonNumber,
            episodeNumber: episode.episode_number,
            name: resolvedName || `Episodio ${episode.episode_number}`,
            airDate: episode.air_date ?? null,
            stillUrl: episode.still_path ? `${TMDB_STILL_URL}${episode.still_path}` : null,
            overview: episode.overview ?? "",
          };
        });
    }),
  );

  const flattened = seasonDetails
    .flat()
    .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);

  return NextResponse.json(flattened, { status: 200 });
}
