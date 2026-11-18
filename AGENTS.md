# AGENTS.md

Panduan untuk coding agent (dan manusia) yang bekerja di repo ini.

## Ringkasan

Aplikasi web cek resi paket multi-kurir (referensi UI: https://cekresi.com/top/). User memilih kurir, memasukkan nomor resi, lalu melihat status dan riwayat perjalanan paket.

**Semua data adalah dummy** dari SQLite lokal. Jangan menambahkan pemanggilan ke API kurir asli, scraping, atau layanan eksternal lain kecuali diminta secara eksplisit.

## Spec-driven

Perilaku sistem didefinisikan di [`specs/`](specs/README.md) sebelum diimplementasikan. Arah pengembangan: monorepo dengan satu service per bahasa (Go, Rust, TypeScript, Python) — lihat [000](specs/000-architecture/spec.md).

- **Jangan menulis fitur baru tanpa spec.** Ubah `spec.md` + `cases.json` dulu, baru kode.
- Test wajib membaca `cases.json` dari spec terkait (jangan menyalin kasusnya ke kode test).
- Kalau kode dan spec berbeda, anggap bug. Tanyakan ke user mana yang benar kalau tidak jelas.
- Setelah selesai, update kolom Status di [specs/README.md](specs/README.md) dan header spec.

Bagian di bawah ini menjelaskan kondisi repo **saat ini** (satu aplikasi Go). Saat spec 000 diimplementasikan, isinya dipindah ke `services/tracking-go/AGENTS.md`.

## Stack

- **Backend**: Go (stdlib `net/http`, pattern routing `GET /path`), satu dependency: `modernc.org/sqlite` (pure Go, tanpa cgo).
- **Frontend**: HTML + CSS + vanilla JS, di-embed ke binary via `embed`. Tanpa framework, bundler, atau build step.
- **DB**: SQLite. Schema + seed dijalankan otomatis setiap start (idempotent).

Jangan menambah dependency (Go maupun JS) tanpa alasan kuat. Prefer stdlib.

## Struktur

```
main.go                  wiring saja: env, store.Open, routing, ListenAndServe
internal/store/          SEMUA akses SQL. Tidak tahu soal HTTP/JSON.
  store.go               Open, ListCouriers, GetCourier, FindShipment
  schema.sql             DDL (CREATE TABLE IF NOT EXISTS)
  seed.sql               data dummy (INSERT OR IGNORE)
internal/api/            HTTP handler + bentuk JSON. Tidak menulis SQL.
  api.go                 Register(mux, store), handler, helper writeJSON/writeError
  api_test.go            test table-driven via httptest + store ":memory:"
web/                     frontend statis, di-embed (web/embed.go)
  index.html, app.js, style.css
```

Aturan layer: `api` → `store` → SQLite. `web/app.js` hanya fetch + render; validasi dan logic bisnis ada di Go.

## Commands

```sh
make run        # go run . → http://localhost:8080
make test       # go test ./...
make vet        # go vet ./...
make fmt        # gofmt -w .
make reset-db   # hapus cekresi.db (seed ulang saat run)
```

Env: `PORT` (default `8080`), `DB_PATH` (default `cekresi.db`, di-gitignore).

## Kontrak API

| Method | Path | Respon |
|---|---|---|
| GET | `/api/couriers` | `200 [{code, name}]` |
| GET | `/api/track?courier=<code>&awb=<resi>` | `200` objek tracking, `400` param kosong / kurir tidak dikenal, `404` resi tidak ada |
| GET | `/` | file statis dari `web/` |

Input dinormalisasi di server: `courier` → trim + lowercase, `awb` → trim + uppercase.

Respon `200` `/api/track`:

```json
{
  "awb": "004000123456",
  "courier": { "code": "sicepat", "name": "SiCepat Ekspres" },
  "sender": "Budi Santoso", "receiver": "Siti Aminah",
  "origin": "Jakarta Barat", "destination": "Bandung",
  "service": "REG",
  "status": "DELIVERED",
  "history": [
    { "time": "2026-11-11T13:47:00+07:00", "location": "Bandung", "description": "..." }
  ]
}
```

- `status` ∈ `PICKED_UP | IN_TRANSIT | OUT_FOR_DELIVERY | DELIVERED | RETURNED`. Label bahasa Indonesia ada di `STATUS_LABEL` (`web/app.js`), warna badge di `.status-*` (`web/style.css`).
- `history` selalu array (bisa kosong), urut **terbaru dulu**.
- `time` ISO 8601 dengan offset (+07:00).
- Semua error: `{"error": "<pesan bahasa Indonesia>"}`. Error 500 di-log, pesan ke client generik.

Kalau kontrak berubah, update bagian ini dan README.

## Resep

**Tambah kurir** — tambah baris di `couriers` pada `internal/store/seed.sql`. Urutan tombol di UI = urutan insert. Update angka di `TestListCouriers`.

**Tambah resi dummy** — tambah baris di `shipments` + beberapa `tracking_events` di `seed.sql`. Tambahkan juga ke tabel resi dummy di README. Jalankan `make reset-db` bila DB lokal sudah ada dan baris diubah (bukan ditambah), karena seed memakai `INSERT OR IGNORE`.

**Tambah field di respon** — urutannya: `schema.sql` + `seed.sql` → struct & query di `store.go` → `*JSON` struct + mapping di `api.go` → render di `app.js`/`index.html` → test di `api_test.go` → kontrak di file ini.

**Tambah status baru** — tambah di komentar `schema.sql`, `STATUS_LABEL` (`app.js`), kelas `.status-*` (`style.css`), dan daftar status di file ini.

## Konvensi

- Go: `gofmt`, error dibungkus `fmt.Errorf("konteks: %w", err)`, sentinel `store.ErrNotFound` dicek dengan `errors.Is`.
- Struct di `store` tanpa tag JSON; bentuk JSON hanya di `api`.
- Query selalu pakai placeholder `?`, jangan string concat.
- Test: table-driven, pakai `store.Open(ctx, ":memory:")` — jangan bergantung pada file `cekresi.db`.
- JS: render dengan `textContent`/`createElement`, jangan `innerHTML` dengan data dari API.
- Teks yang tampil ke user dalam bahasa Indonesia.

## Definition of done

1. `make fmt && make vet && make test` hijau.
2. `make run`, cek manual di browser: pilih kurir, cek resi dummy, resi tidak ada (pesan error), riwayat pencarian.
3. Kontrak API / resep di file ini masih akurat.
