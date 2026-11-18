package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"cek-resi/internal/api"
	"cek-resi/internal/store"
	"cek-resi/web"
)

func main() {
	dbPath := getenv("DB_PATH", "cekresi.db")
	addr := ":" + getenv("PORT", "8080")

	s, err := store.Open(context.Background(), dbPath)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer s.Close()

	mux := http.NewServeMux()
	api.Register(mux, s)
	mux.Handle("GET /", http.FileServerFS(web.FS))

	log.Printf("cek-resi listening on http://localhost%s (db: %s)", addr, dbPath)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
