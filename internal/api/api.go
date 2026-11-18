// Package api exposes the tracking store over HTTP as JSON.
package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"cek-resi/internal/store"
)

type courierJSON struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type eventJSON struct {
	Time        string `json:"time"`
	Location    string `json:"location"`
	Description string `json:"description"`
}

type trackJSON struct {
	AWB         string      `json:"awb"`
	Courier     courierJSON `json:"courier"`
	Sender      string      `json:"sender"`
	Receiver    string      `json:"receiver"`
	Origin      string      `json:"origin"`
	Destination string      `json:"destination"`
	Service     string      `json:"service"`
	Status      string      `json:"status"`
	History     []eventJSON `json:"history"`
}

type handler struct {
	store *store.Store
}

// Register mounts the API routes on mux.
func Register(mux *http.ServeMux, s *store.Store) {
	h := &handler{store: s}
	mux.HandleFunc("GET /api/couriers", h.listCouriers)
	mux.HandleFunc("GET /api/track", h.track)
}

func (h *handler) listCouriers(w http.ResponseWriter, r *http.Request) {
	couriers, err := h.store.ListCouriers(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	out := make([]courierJSON, 0, len(couriers))
	for _, c := range couriers {
		out = append(out, courierJSON{Code: c.Code, Name: c.Name})
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *handler) track(w http.ResponseWriter, r *http.Request) {
	courier := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("courier")))
	awb := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("awb")))
	if courier == "" || awb == "" {
		writeError(w, http.StatusBadRequest, "parameter courier dan awb wajib diisi")
		return
	}

	if _, err := h.store.GetCourier(r.Context(), courier); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusBadRequest, "kurir tidak dikenal")
			return
		}
		internalError(w, err)
		return
	}

	sh, err := h.store.FindShipment(r.Context(), courier, awb)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "resi tidak ditemukan")
			return
		}
		internalError(w, err)
		return
	}

	out := trackJSON{
		AWB:         sh.AWB,
		Courier:     courierJSON{Code: sh.Courier.Code, Name: sh.Courier.Name},
		Sender:      sh.Sender,
		Receiver:    sh.Receiver,
		Origin:      sh.Origin,
		Destination: sh.Destination,
		Service:     sh.Service,
		Status:      sh.Status,
		History:     make([]eventJSON, 0, len(sh.History)),
	}
	for _, e := range sh.History {
		out.History = append(out.History, eventJSON{Time: e.OccurredAt, Location: e.Location, Description: e.Description})
	}
	writeJSON(w, http.StatusOK, out)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("write json: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func internalError(w http.ResponseWriter, err error) {
	log.Printf("internal error: %v", err)
	writeError(w, http.StatusInternalServerError, "terjadi kesalahan pada server")
}
