# AGENTS.md — tracking-go

Service Go pemilik data resi & kurir (SQLite dummy). Aturan umum monorepo ada di [../../AGENTS.md](../../AGENTS.md); spec: [001](../../specs/001-tracking-provider/spec.md).

- Port `8081` (env `PORT`), DB `DB_PATH` (default `cekresi.db`, di-gitignore).
- Stack: Go stdlib `net/http` + `modernc.org/sqlite` (pure Go). Jangan tambah dependency tanpa alasan kuat.
- Task: `mise run {dev,test,lint,fmt}:tracking`.

## Struktur

```
main.go                  wiring saja: env, store.Open, routing, ListenAndServe
internal/store/          SEMUA akses SQL. Tidak tahu soal HTTP/JSON.
  schema.sql, seed.sql   DDL + data dummy (INSERT OR IGNORE, idempotent)
internal/api/            HTTP handler + bentuk JSON. Tidak menulis SQL.
  api_test.go            test table-driven (httptest + store ":memory:")
  spec_test.go           menjalankan specs/*/cases.json
internal/spectest/       harness spec (matchPartial + loader), test-only
```

Layer: `api` → `store` → SQLite.

## Kontrak

Lihat [spec 000](../../specs/000-architecture/spec.md) dan [spec 001](../../specs/001-tracking-provider/spec.md). Endpoint saat ini: `GET /health`, `GET /api/couriers`, `GET /api/track?courier=&awb=`. Field `source` dan provider adapter belum ada (bagian spec 001).

## Resep

- **Tambah kurir**: baris di `couriers` pada `seed.sql` (urutan insert = urutan UI), update tabel kanonik di spec 000.
- **Tambah resi dummy**: baris di `shipments` + `tracking_events` pada `seed.sql`. Seed memakai `INSERT OR IGNORE`: kalau mengubah baris yang sudah ada, hapus `cekresi.db`.
- **Tambah field respon**: `schema.sql`/`seed.sql` → `store.go` → struct JSON di `api.go` → `web/app.js` → test → spec.
- **Implementasi spec baru milik service ini**: tambahkan path `cases.json`-nya ke `specFiles` di `internal/api/spec_test.go`.

## Konvensi

- Error dibungkus `fmt.Errorf("konteks: %w", err)`; sentinel `store.ErrNotFound` dicek dengan `errors.Is`.
- Struct di `store` tanpa tag JSON; bentuk JSON hanya di `api`.
- Query pakai placeholder `?`. Test pakai `store.Open(ctx, ":memory:")`.
- Pesan ke user dalam bahasa Indonesia.
