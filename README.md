# TrackSM

MVP de um tracker de series no estilo TrackSeries, com backend em Go e frontend em Next.js.

## Stack

- Go (API REST)
- Next.js 15 + React 19 (frontend)

## Estrutura

- `backend/main.go`: API com endpoints para listar, criar, atualizar status e remover series.
- `frontend/app/page.tsx`: interface principal com busca, filtro, cadastro e cards.

## Rodando localmente

### 1) Backend (Go)

```bash
cd backend
go run .
```

API em `http://localhost:8080`.

### 2) Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

App em `http://localhost:3000`.

Para abrir no celular (mesma rede Wi-Fi):

```bash
cd frontend
npm run dev:lan:webpack
```

Depois acesse `http://SEU_IP_LOCAL:3000` no celular (ex.: `http://192.168.1.10:3000`).
Se der timeout, libere a porta `3000` no Firewall do Windows para rede privada.

Se quiser alterar a URL da API no frontend:

```bash
set NEXT_PUBLIC_API_URL=http://localhost:8080
npm run dev
```

## Endpoints

- `GET /health`
- `GET /api/series?q=<texto>&status=planned|watching|completed`
- `POST /api/series`
- `PATCH /api/series/{id}`
- `DELETE /api/series/{id}`
