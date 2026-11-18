package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/hallode/cek-resi/services/tracking-go/internal/api"
	"github.com/hallode/cek-resi/services/tracking-go/internal/store"
)

func main() {
	dbPath := getenv("DB_PATH", "cekresi.db")
	addr := ":" + getenv("PORT", "8081")

	s, err := store.Open(context.Background(), dbPath)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer s.Close()

	mux := http.NewServeMux()
	api.Register(mux, s)

	log.Printf("tracking-go listening on %s (db: %s)", addr, dbPath)
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
