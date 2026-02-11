package main

import (
    "database/sql"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
    "strconv"
    "strings"
    "sync"

    "golang.org/x/crypto/bcrypt"
    _ "modernc.org/sqlite"
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

type App struct {
    store *Store
    db    *sql.DB
}

type RegisterInput struct {
    Name     string `json:"name"`
    Email    string `json:"email"`
    Password string `json:"password"`
}

type RegisterResponse struct {
    ID    int64  `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

type LoginInput struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

type LoginResponse struct {
    ID    int64  `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
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
    db, err := openDatabase()
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    if err := ensureUsersTable(db); err != nil {
        log.Fatal(err)
    }

    app := &App{store: store, db: db}
    mux := http.NewServeMux()

    mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
        writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
    })

    mux.HandleFunc("GET /api/series", app.store.handleListSeries)
    mux.HandleFunc("POST /api/series", app.store.handleCreateSeries)
    mux.HandleFunc("PATCH /api/series/", app.store.handlePatchSeries)
    mux.HandleFunc("DELETE /api/series/", app.store.handleDeleteSeries)
    mux.HandleFunc("POST /api/auth/register", app.handleRegister)
    mux.HandleFunc("POST /api/auth/login", app.handleLogin)

    addr := ":8080"
    log.Printf("API running on http://localhost%s", addr)
    if err := http.ListenAndServe(addr, cors(mux)); err != nil {
        log.Fatal(err)
    }
}

func openDatabase() (*sql.DB, error) {
    dbPath := envOrDefault("DB_PATH", "tracksm.db")
    db, err := sql.Open("sqlite", dbPath)
    if err != nil {
        return nil, fmt.Errorf("failed opening sqlite: %w", err)
    }

    if err := db.Ping(); err != nil {
        return nil, fmt.Errorf("failed pinging sqlite: %w", err)
    }

    return db, nil
}

func ensureUsersTable(db *sql.DB) error {
    query := `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    `

    if _, err := db.Exec(query); err != nil {
        return fmt.Errorf("failed creating users table: %w", err)
    }

    return nil
}

func (a *App) handleRegister(w http.ResponseWriter, r *http.Request) {
    var in RegisterInput
    if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
        writeError(w, http.StatusBadRequest, "invalid json body")
        return
    }

    in.Name = strings.TrimSpace(in.Name)
    in.Email = strings.ToLower(strings.TrimSpace(in.Email))

    if in.Name == "" {
        writeError(w, http.StatusBadRequest, "name is required")
        return
    }

    if in.Email == "" || !strings.Contains(in.Email, "@") {
        writeError(w, http.StatusBadRequest, "valid email is required")
        return
    }

    if len(in.Password) < 6 {
        writeError(w, http.StatusBadRequest, "password must have at least 6 characters")
        return
    }

    hashBytes, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to process password")
        return
    }

    result, err := a.db.Exec(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
        in.Name,
        in.Email,
        string(hashBytes),
    )
    if err != nil {
        if strings.Contains(strings.ToLower(err.Error()), "unique constraint failed: users.email") {
            writeError(w, http.StatusConflict, "email already registered")
            return
        }

        writeError(w, http.StatusInternalServerError, "failed to create user")
        return
    }

    id, _ := result.LastInsertId()
    writeJSON(w, http.StatusCreated, RegisterResponse{
        ID:    id,
        Name:  in.Name,
        Email: in.Email,
    })
}

func (a *App) handleLogin(w http.ResponseWriter, r *http.Request) {
    var in LoginInput
    if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
        writeError(w, http.StatusBadRequest, "invalid json body")
        return
    }

    in.Email = strings.ToLower(strings.TrimSpace(in.Email))

    if in.Email == "" || in.Password == "" {
        writeError(w, http.StatusBadRequest, "email and password are required")
        return
    }

    var (
        id           int64
        name         string
        email        string
        passwordHash string
    )

    err := a.db.QueryRow(
        "SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1",
        in.Email,
    ).Scan(&id, &name, &email, &passwordHash)
    if err == sql.ErrNoRows {
        writeError(w, http.StatusUnauthorized, "invalid credentials")
        return
    }
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to authenticate user")
        return
    }

    if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(in.Password)); err != nil {
        writeError(w, http.StatusUnauthorized, "invalid credentials")
        return
    }

    writeJSON(w, http.StatusOK, LoginResponse{
        ID:    id,
        Name:  name,
        Email: email,
    })
}

func envOrDefault(key string, fallback string) string {
    value := strings.TrimSpace(os.Getenv(key))
    if value == "" {
        return fallback
    }

    return value
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
