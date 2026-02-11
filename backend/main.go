package main

import (
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "strconv"
    "strings"
    "sync"
)

type Series struct {
    ID       int     `json:"id"`
    Title    string  `json:"title"`
    Overview string  `json:"overview"`
    Poster   string  `json:"poster"`
    Seasons  int     `json:"seasons"`
    Status   string  `json:"status"`
    Rating   float64 `json:"rating"`
}

type CreateSeriesInput struct {
    Title    string  `json:"title"`
    Overview string  `json:"overview"`
    Poster   string  `json:"poster"`
    Seasons  int     `json:"seasons"`
    Status   string  `json:"status"`
    Rating   float64 `json:"rating"`
}

type UpdateSeriesInput struct {
    Overview *string  `json:"overview"`
    Poster   *string  `json:"poster"`
    Seasons  *int     `json:"seasons"`
    Status   *string  `json:"status"`
    Rating   *float64 `json:"rating"`
}

type Store struct {
    mu     sync.RWMutex
    nextID int
    items  []Series
}

func NewStore() *Store {
    return &Store{
        nextID: 4,
        items: []Series{
            {
                ID:       1,
                Title:    "Breaking Bad",
                Overview: "Professor de química vira produtor de metanfetamina.",
                Poster:   "https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
                Seasons:  5,
                Status:   "completed",
                Rating:   9.5,
            },
            {
                ID:       2,
                Title:    "Severance",
                Overview: "Funcionários separam memórias pessoais e de trabalho.",
                Poster:   "https://image.tmdb.org/t/p/w500/lF4M1taK9Q4S3mM7Qv7v6V5T4Qf.jpg",
                Seasons:  2,
                Status:   "watching",
                Rating:   9.0,
            },
            {
                ID:       3,
                Title:    "Dark",
                Overview: "Mistérios temporais em uma cidade alemã.",
                Poster:   "https://image.tmdb.org/t/p/w500/5Lo5fY2R8xk3Q4zNwJ2Y8Q6kU2q.jpg",
                Seasons:  3,
                Status:   "planned",
                Rating:   8.8,
            },
        },
    }
}

func main() {
    store := NewStore()
    mux := http.NewServeMux()

    mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
        writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
    })

    mux.HandleFunc("GET /api/series", store.handleListSeries)
    mux.HandleFunc("POST /api/series", store.handleCreateSeries)
    mux.HandleFunc("PATCH /api/series/", store.handlePatchSeries)
    mux.HandleFunc("DELETE /api/series/", store.handleDeleteSeries)

    addr := ":8080"
    log.Printf("API running on http://localhost%s", addr)
    if err := http.ListenAndServe(addr, cors(mux)); err != nil {
        log.Fatal(err)
    }
}

func (s *Store) handleListSeries(w http.ResponseWriter, r *http.Request) {
    status := strings.TrimSpace(r.URL.Query().Get("status"))
    q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))

    s.mu.RLock()
    defer s.mu.RUnlock()

    out := make([]Series, 0, len(s.items))
    for _, item := range s.items {
        if status != "" && item.Status != status {
            continue
        }

        if q != "" {
            if !strings.Contains(strings.ToLower(item.Title), q) && !strings.Contains(strings.ToLower(item.Overview), q) {
                continue
            }
        }

        out = append(out, item)
    }

    writeJSON(w, http.StatusOK, out)
}

func (s *Store) handleCreateSeries(w http.ResponseWriter, r *http.Request) {
    var in CreateSeriesInput
    if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
        writeError(w, http.StatusBadRequest, "invalid json body")
        return
    }

    in.Title = strings.TrimSpace(in.Title)
    in.Status = strings.TrimSpace(in.Status)

    if in.Title == "" {
        writeError(w, http.StatusBadRequest, "title is required")
        return
    }

    if in.Status == "" {
        in.Status = "planned"
    }

    s.mu.Lock()
    defer s.mu.Unlock()

    item := Series{
        ID:       s.nextID,
        Title:    in.Title,
        Overview: in.Overview,
        Poster:   in.Poster,
        Seasons:  in.Seasons,
        Status:   in.Status,
        Rating:   in.Rating,
    }

    s.nextID++
    s.items = append(s.items, item)

    writeJSON(w, http.StatusCreated, item)
}

func (s *Store) handlePatchSeries(w http.ResponseWriter, r *http.Request) {
    id, err := parseIDFromPath(r.URL.Path)
    if err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }

    var in UpdateSeriesInput
    if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
        writeError(w, http.StatusBadRequest, "invalid json body")
        return
    }

    s.mu.Lock()
    defer s.mu.Unlock()

    idx := -1
    for i := range s.items {
        if s.items[i].ID == id {
            idx = i
            break
        }
    }

    if idx == -1 {
        writeError(w, http.StatusNotFound, "series not found")
        return
    }

    if in.Overview != nil {
        s.items[idx].Overview = *in.Overview
    }

    if in.Poster != nil {
        s.items[idx].Poster = *in.Poster
    }

    if in.Seasons != nil {
        s.items[idx].Seasons = *in.Seasons
    }

    if in.Status != nil {
        s.items[idx].Status = strings.TrimSpace(*in.Status)
    }

    if in.Rating != nil {
        s.items[idx].Rating = *in.Rating
    }

    writeJSON(w, http.StatusOK, s.items[idx])
}

func (s *Store) handleDeleteSeries(w http.ResponseWriter, r *http.Request) {
    id, err := parseIDFromPath(r.URL.Path)
    if err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }

    s.mu.Lock()
    defer s.mu.Unlock()

    idx := -1
    for i := range s.items {
        if s.items[i].ID == id {
            idx = i
            break
        }
    }

    if idx == -1 {
        writeError(w, http.StatusNotFound, "series not found")
        return
    }

    s.items = append(s.items[:idx], s.items[idx+1:]...)
    w.WriteHeader(http.StatusNoContent)
}

func parseIDFromPath(path string) (int, error) {
    trimmed := strings.Trim(path, "/")
    parts := strings.Split(trimmed, "/")
    if len(parts) != 3 || parts[0] != "api" || parts[1] != "series" {
        return 0, fmt.Errorf("invalid path")
    }

    id, err := strconv.Atoi(parts[2])
    if err != nil {
        return 0, fmt.Errorf("invalid series id")
    }

    return id, nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    _ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
    writeJSON(w, status, map[string]string{"error": msg})
}

func cors(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Access-Control-Allow-Origin", "*")
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

        if r.Method == http.MethodOptions {
            w.WriteHeader(http.StatusNoContent)
            return
        }

        next.ServeHTTP(w, r)
    })
}
