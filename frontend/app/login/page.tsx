import Link from "next/link";
import LoginBackgroundSlideshow from "../components/login-background-slideshow";
import LoginForm from "../components/login-form";

type TmdbLoginItem = {
  backdrop_path: string | null;
};

type TmdbLoginResponse = {
  results: TmdbLoginItem[];
};

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_BACKDROP_URL = "https://image.tmdb.org/t/p/original";

async function fetchLoginSlides(path: "movie/popular" | "tv/popular"): Promise<string[]> {
  if (!TMDB_API_KEY) return [];

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: "pt-BR",
    page: "1",
  });

  const res = await fetch(`${TMDB_BASE_URL}/${path}?${params.toString()}`, {
    next: { revalidate: 1800 },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as TmdbLoginResponse;
  return data.results
    .map((item) => item.backdrop_path)
    .filter((path): path is string => Boolean(path))
    .map((path) => `${TMDB_BACKDROP_URL}${path}`);
}

export default async function LoginPage() {
  const [movieSlides, tvSlides] = await Promise.all([fetchLoginSlides("movie/popular"), fetchLoginSlides("tv/popular")]);
  const slides = [...movieSlides, ...tvSlides].slice(0, 14);

  return (
    <main className="login-page">
      <LoginBackgroundSlideshow slides={slides} />
      <div className="login-overlay" aria-hidden="true" />

      <section className="login-card" aria-label="Acesso a conta">
        <p className="login-kicker">Acesso</p>
        <h1 className="login-title">Entrar no TrackSM</h1>
        <p className="login-subtitle">Acompanhe filmes e series, favoritos e histórico em um so lugar.</p>

        <LoginForm />

        <p className="login-footer">
          Ainda nao tem conta?{" "}
          <Link href="/cadastro" className="login-footer-link">
            Criar conta
          </Link>
        </p>
      </section>
    </main>
  );
}
