import { NextRequest, NextResponse } from "next/server";

type TmdbItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  vote_average: number;
};

type TmdbResponse = {
  results?: TmdbItem[];
};

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

function parseIds(raw: string): number[] {
  return raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
    .slice(0, 8);
}

function parseMediaType(raw: string | null): "movie" | "tv" | null {
  if (raw === "movie" || raw === "tv") return raw;
  return null;
}

export async function GET(request: NextRequest) {
  if (!TMDB_API_KEY) return NextResponse.json([], { status: 200 });

  const mediaType = parseMediaType(request.nextUrl.searchParams.get("mediaType"));
  const ids = parseIds(request.nextUrl.searchParams.get("ids") || "");

  if (!mediaType || !ids.length) {
    return NextResponse.json([], { status: 200 });
  }

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: "pt-BR",
    page: "1",
  });

  const responses = await Promise.all(
    ids.map((id) =>
      fetch(`${TMDB_BASE_URL}/${mediaType}/${id}/recommendations?${params.toString()}`, {
        next: { revalidate: 1800 },
      }),
    ),
  );

  const itemsById = new Map<number, TmdbItem>();

  await Promise.all(
    responses.map(async (response) => {
      if (!response.ok) return;
      const data = (await response.json()) as TmdbResponse;
      for (const item of data.results ?? []) {
        if (!item?.id || ids.includes(item.id)) continue;
        if (itemsById.has(item.id)) continue;
        itemsById.set(item.id, item);
      }
    }),
  );

  const sorted = Array.from(itemsById.values()).sort((a, b) => b.vote_average - a.vote_average || a.id - b.id);
  return NextResponse.json(sorted.slice(0, 60), { status: 200 });
}

