// Package store owns all SQL access to the dummy tracking database.
package store

import (
	"context"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"

	_ "modernc.org/sqlite"
)

var (
	//go:embed schema.sql
	schemaSQL string
	//go:embed seed.sql
	seedSQL string
)

// ErrNotFound is returned when a courier or shipment does not exist.
var ErrNotFound = errors.New("not found")

type Courier struct {
	Code string
	Name string
}

type Event struct {
	OccurredAt  string // ISO 8601 with offset
	Location    string
	Description string
}

type Shipment struct {
	AWB         string
	Courier     Courier
	Sender      string
	Receiver    string
	Origin      string
	Destination string
	Service     string
	Status      string
	History     []Event // newest first
}

type Store struct {
	db *sql.DB
}

// Open opens (or creates) the SQLite database at path, then applies the
// schema and dummy seed. Use ":memory:" for tests.
func Open(ctx context.Context, path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	// Single connection keeps ":memory:" databases shared and avoids
	// SQLite write contention; plenty for a dummy dataset.
	db.SetMaxOpenConns(1)

	if _, err := db.ExecContext(ctx, schemaSQL); err != nil {
		db.Close()
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	if _, err := db.ExecContext(ctx, seedSQL); err != nil {
		db.Close()
		return nil, fmt.Errorf("apply seed: %w", err)
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) ListCouriers(ctx context.Context) ([]Courier, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT code, name FROM couriers ORDER BY rowid`)
	if err != nil {
		return nil, fmt.Errorf("list couriers: %w", err)
	}
	defer rows.Close()

	var couriers []Courier
	for rows.Next() {
		var c Courier
		if err := rows.Scan(&c.Code, &c.Name); err != nil {
			return nil, fmt.Errorf("scan courier: %w", err)
		}
		couriers = append(couriers, c)
	}
	return couriers, rows.Err()
}

func (s *Store) GetCourier(ctx context.Context, code string) (Courier, error) {
	var c Courier
	err := s.db.QueryRowContext(ctx, `SELECT code, name FROM couriers WHERE code = ?`, code).Scan(&c.Code, &c.Name)
	if errors.Is(err, sql.ErrNoRows) {
		return Courier{}, ErrNotFound
	}
	if err != nil {
		return Courier{}, fmt.Errorf("get courier: %w", err)
	}
	return c, nil
}

// FindShipment returns the shipment and its tracking history (newest first).
func (s *Store) FindShipment(ctx context.Context, courierCode, awb string) (Shipment, error) {
	sh := Shipment{AWB: awb}
	err := s.db.QueryRowContext(ctx, `
		SELECT c.code, c.name, s.sender, s.receiver, s.origin, s.destination, s.service, s.status
		FROM shipments s JOIN couriers c ON c.code = s.courier_code
		WHERE s.courier_code = ? AND s.awb = ?`, courierCode, awb,
	).Scan(&sh.Courier.Code, &sh.Courier.Name, &sh.Sender, &sh.Receiver,
		&sh.Origin, &sh.Destination, &sh.Service, &sh.Status)
	if errors.Is(err, sql.ErrNoRows) {
		return Shipment{}, ErrNotFound
	}
	if err != nil {
		return Shipment{}, fmt.Errorf("find shipment: %w", err)
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT occurred_at, location, description
		FROM tracking_events
		WHERE courier_code = ? AND awb = ?
		ORDER BY occurred_at DESC`, courierCode, awb)
	if err != nil {
		return Shipment{}, fmt.Errorf("list events: %w", err)
	}
	defer rows.Close()

	sh.History = []Event{}
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.OccurredAt, &e.Location, &e.Description); err != nil {
			return Shipment{}, fmt.Errorf("scan event: %w", err)
		}
		sh.History = append(sh.History, e)
	}
	return sh, rows.Err()
}
