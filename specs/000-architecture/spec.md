# 000 — Arsitektur monorepo polyglot

| | |
|---|---|
| Status | Draft |
| Service pemilik | semua |
| Bergantung pada | — |
| Test vectors | [`cases.json`](cases.json) (health check semua service) |

## Latar belakang
Base project saat ini satu aplikasi Go di root repo. Fitur berikutnya (deteksi kurir, cek banyak resi, provider adapter, ongkir) dibagi ke beberapa service, **satu service per bahasa**, di dalam satu monorepo. Spec ini menetapkan layout, aturan lintas-service, dan cara testing yang dipakai semua spec lain.

## Scope
- Masuk: layout repo, pembagian service & port, konvensi HTTP/JSON bersama, data kurir kanonik, strategi testing, CI.
- Tidak masuk: Docker/Kubernetes, auth, rate limiting, API kurir asli.

## Layout target

```
cek-resi/
├── AGENTS.md
├── specs/                     # spec + cases.json (sumber kebenaran perilaku)
├── web/                       # frontend statis (HTML/CSS/vanilla JS), diserve gateway
├── services/
│   ├── gateway-ts/            # TypeScript — pintu masuk publik
│   ├── tracking-go/           # Go — data resi & kurir (kode yang sudah ada dipindah ke sini)
│   ├── detect-rust/           # Rust — deteksi kurir dari pola resi
│   └── ongkir-py/             # Python — kalkulasi ongkir
├── Makefile                   # dev (jalankan semua), test (semua service)
└── .github/workflows/ci.yml   # satu job per service + satu job e2e
```

## Service

| Service | Bahasa & stack | Port | Path publik yang dimiliki | Data |
|---|---|---|---|---|
| `gateway-ts` | TypeScript di Node 24 (native type stripping), stdlib `node:http` + `fetch`, test `node:test`; tanpa dependency runtime | 8080 | `/`, file statis, `/api/track/bulk`, `/health` | — |
| `tracking-go` | Go, stdlib `net/http` + `modernc.org/sqlite` | 8081 | `/api/couriers`, `/api/track` | SQLite dummy (milik sendiri) |
| `detect-rust` | Rust, `axum` + `tokio` + `serde` + `regex` | 8082 | `/api/detect` | tabel pola di kode |
| `ongkir-py` | Python 3.12, `FastAPI` + `uvicorn`, test `pytest`, dikelola `uv` | 8083 | `/api/ongkir`, `/api/ongkir/cities` | tabel tarif di kode |

### Aturan arsitektur
- **A1** — Browser hanya bicara ke gateway. Gateway meneruskan request berdasarkan prefix path ke service pemilik **tanpa mengubah path**, sehingga setiap service mengekspos path publiknya sendiri dan bisa dites langsung.
- **A2** — Service lain hanya berkomunikasi lewat HTTP JSON sesuai spec. Tidak ada import kode lintas service, tidak ada DB bersama.
- **A3** — Setiap service punya `GET /health` → `200 {"status":"ok","service":"<nama-service>"}`.
- **A4** — URL upstream di gateway diatur lewat env: `TRACKING_URL`, `DETECT_URL`, `ONGKIR_URL` (default `http://localhost:<port>`). Port setiap service lewat env `PORT`.
- **A5** — Timeout gateway → service: 3 detik. Timeout atau koneksi gagal → `502 {"error":"layanan <nama> tidak tersedia"}` (untuk request tunggal).
- **A6** — Semua data dummy. Tidak boleh memanggil API kurir asli atau layanan eksternal.

## Konvensi HTTP/JSON (berlaku di semua service)
- **K1** — Respon selalu `application/json; charset=utf-8` (kecuali file statis).
- **K2** — Error selalu `{"error": "<pesan bahasa Indonesia>"}`. 4xx untuk kesalahan input, 404 untuk data tidak ada, 5xx pesan generik + detail hanya di log.
- **K3** — Normalisasi input: kode kurir → trim + lowercase; nomor resi → trim + uppercase; kode kota → trim + uppercase.
- **K4** — Nama field JSON `snake_case`. Waktu ISO 8601 dengan offset (`2026-11-11T13:47:00+07:00`). Uang dalam rupiah, integer.
- **K5** — Array di respon tidak pernah `null`; kosong = `[]`.

## Kurir kanonik
Daftar kode ini dipakai bersama oleh semua service. Sumber datanya `tracking-go` (`GET /api/couriers`); service lain cukup memakai kodenya.

| Kode | Nama |
|---|---|
| `jnt` | J&T Express |
| `jne` | JNE Express |
| `jntcargo` | J&T Cargo |
| `spx` | SPX Express |
| `sicepat` | SiCepat Ekspres |
| `lion` | Lion Parcel |
| `tiki` | TIKI |
| `pos` | Pos Indonesia |
| `indah` | Indah Cargo |
| `anteraja` | Anteraja |

Menambah kurir = update tabel ini, lalu seed `tracking-go`, lalu pola di 002 dan tarif di 004 jika relevan.

## Testing
- Setiap service punya test yang memuat `specs/<id>/cases.json` miliknya (`level: service`) dan helper `matchPartial` sesuai [specs/README.md](../README.md#format-casesjson).

  | Service | Lokasi helper | Cara memuat cases |
  |---|---|---|
  | tracking-go | `internal/spectest/spectest.go` | `os.ReadFile("../../../../specs/…")` via path relatif dari package test |
  | detect-rust | `tests/spec.rs` | `include_str!("../../../specs/…")` |
  | gateway-ts | `src/spectest.ts` | `fs.readFile(new URL("../../../specs/…", import.meta.url))` |
  | ongkir-py | `tests/spectest.py` | `Path(__file__).parents[3] / "specs" / …` |

- Kasus `level: e2e` dijalankan oleh `gateway-ts` (`npm run test:e2e`, butuh semua service hidup) dan job CI `e2e`.
- Data dummy deterministik; test tidak boleh bergantung pada jam sistem atau urutan acak.

## Kriteria penerimaan
- [ ] Kode Go yang ada pindah ke `services/tracking-go/` dan `web/` ke root; perilaku API tidak berubah (cases 001 lulus).
- [ ] Keempat service jalan dan `/health` sesuai A3 (cases 000 lulus, langsung ke masing-masing service).
- [ ] `make dev` menjalankan semua service; `http://localhost:8080` menampilkan UI dan cek resi berfungsi via gateway.
- [ ] CI punya job per service + e2e, semuanya hijau.

## Tasks
- [ ] `git mv` kode Go ke `services/tracking-go/`, hapus serve web dari Go, port default 8081, tambah `/health`.
- [ ] Pindah `web/` (hapus `embed.go`), gateway serve statis + proxy `/api/couriers`, `/api/track`.
- [ ] Skeleton `detect-rust` & `ongkir-py` dengan `/health`.
- [ ] Helper `matchPartial` per bahasa + loader `cases.json`.
- [ ] Root `Makefile`, `.github/workflows/ci.yml`, update `AGENTS.md` root + `AGENTS.md` per service.
