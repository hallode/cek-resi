package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/hallode/cek-resi/services/tracking-go/internal/store"
)

func newServer(t *testing.T) *http.ServeMux {
	t.Helper()
	s, err := store.Open(context.Background(), ":memory:")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { s.Close() })

	mux := http.NewServeMux()
	Register(mux, s)
	return mux
}

func TestListCouriers(t *testing.T) {
	mux := newServer(t)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/couriers", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var got []courierJSON
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 10 {
		t.Fatalf("len(couriers) = %d, want 10", len(got))
	}
}

func TestTrack(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		wantStatus int
		wantEvents int
	}{
		{"found", "?courier=sicepat&awb=004000123456", http.StatusOK, 6},
		{"normalizes input", "?courier=%20SiCepat%20&awb=%20004000123456%20", http.StatusOK, 6},
		{"lowercase awb", "?courier=jne&awb=cgk1a00012345", http.StatusOK, 4},
		{"missing awb", "?courier=sicepat", http.StatusBadRequest, 0},
		{"missing courier", "?awb=004000123456", http.StatusBadRequest, 0},
		{"unknown courier", "?courier=foo&awb=004000123456", http.StatusBadRequest, 0},
		{"wrong courier for awb", "?courier=jne&awb=004000123456", http.StatusNotFound, 0},
		{"unknown awb", "?courier=sicepat&awb=999", http.StatusNotFound, 0},
	}

	mux := newServer(t)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/track"+tt.query, nil))

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d; body = %s", rec.Code, tt.wantStatus, rec.Body)
			}
			if tt.wantStatus != http.StatusOK {
				var body map[string]string
				if err := json.NewDecoder(rec.Body).Decode(&body); err != nil || body["error"] == "" {
					t.Fatalf("want {error: ...} body, got %s (err %v)", rec.Body, err)
				}
				return
			}

			var got trackJSON
			if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if len(got.History) != tt.wantEvents {
				t.Fatalf("len(history) = %d, want %d", len(got.History), tt.wantEvents)
			}
			for i := 1; i < len(got.History); i++ {
				if got.History[i-1].Time < got.History[i].Time {
					t.Fatalf("history not newest-first at index %d", i)
				}
			}
		})
	}
}
