# 001 — Tracking + provider adapter

| | |
|---|---|
| Status | Draft (endpoint sudah ada; provider adapter belum) |
| Service pemilik | `tracking-go` (Go) |
| Service lain yang tersentuh | `gateway-ts` (proxy), `web/` |
| Bergantung pada | 000 |
| Test vectors | [`cases.json`](cases.json) |

## Latar belakang
Saat ini handler membaca SQLite langsung lewat `store`. Nanti tiap kurir bisa punya sumber data berbeda (dummy, sandbox, API asli). Spec ini mengunci kontrak API yang sudah ada dan menambah lapisan **provider** supaya sumber data per kurir bisa diganti tanpa menyentuh handler.

## Scope
- Masuk: kontrak `GET /api/couriers` dan `GET /api/track` (sudah berjalan), interface `Provider` + registry, field `source` di respon.
- Tidak masuk: provider API kurir asli (dilarang oleh A6), caching, deteksi kurir (002).

## Kontrak API

### `GET /api/couriers`
`200` → `[{ "code": "jnt", "name": "J&T Express" }, …]` — urutan sesuai tabel kurir kanonik di 000.

### `GET /api/track?courier=<code>&awb=<resi>`

`200`:
```json
{
  "awb": "004000123456",
  "courier": { "code": "sicepat", "name": "SiCepat Ekspres" },
  "sender": "Budi Santoso",
  "receiver": "Siti Aminah",
  "origin": "Jakarta Barat",
  "destination": "Bandung",
  "service": "REG",
  "status": "DELIVERED",
  "source": "dummy",
  "history": [
    { "time": "2026-11-11T13:47:00+07:00", "location": "Bandung", "description": "Paket diterima oleh Siti Aminah (Yang bersangkutan)" }
  ]
}
```

| Kondisi | Status | `error` |
|---|---|---|
| `courier` atau `awb` kosong (setelah trim) | 400 | `parameter courier dan awb wajib diisi` |
| kode kurir tidak ada di daftar kanonik | 400 | `kurir tidak dikenal` |
| kurir dikenal tapi tidak punya provider terdaftar | 501 | `kurir belum didukung` |
| resi tidak ditemukan oleh provider | 404 | `resi tidak ditemukan` |
| provider gagal (error lain) | 502 | `gagal mengambil data dari kurir` |

## Aturan perilaku
- **R1** — Input dinormalisasi sesuai K3 sebelum validasi.
- **R2** — `status` ∈ `PICKED_UP | IN_TRANSIT | OUT_FOR_DELIVERY | DELIVERED | RETURNED`.
- **R3** — `history` urut terbaru dulu, selalu array.
- **R4** — `source` menyebut asal data; nilai saat ini hanya `"dummy"`.
- **R5** — Handler tidak tahu soal SQL. Alurnya: handler → registry → `Provider`.

## Desain provider (Go)

```go
// internal/provider/provider.go
type Provider interface {
	// Track returns ErrNotFound when the AWB does not exist for this courier.
	Track(ctx context.Context, awb string) (Shipment, error)
	Source() string // "dummy", nanti mis. "jne-api"
}

type Registry struct{ byCourier map[string]Provider }
func (r *Registry) Register(courierCode string, p Provider)
func (r *Registry) Get(courierCode string) (Provider, bool)
```

- `internal/provider/dummy.go` — `DummyProvider` membungkus `store.Store` untuk satu kode kurir.
- `main.go` mendaftarkan `DummyProvider` untuk **semua** kurir kanonik.
- `store` tetap pemilik SQL, `api` tetap pemilik JSON, `provider` jembatan di antaranya.

## UI
Tab **Cek Resi** (`#/resi`, modul `web/js/resi.js`), mengikuti aturan frontend di [000](../000-architecture/spec.md#frontend-satu-halaman-satu-tab-per-fitur) (F1–F7). Perilakunya sama dengan UI cek resi yang sudah ada, ditambah permalink:

- Tombol kurir dari `GET /api/couriers`, input No Resi, riwayat pencarian (10 terakhir, `localStorage`).
- Hasil: no resi, ekspedisi, layanan, pengirim → penerima, badge status (label & warna per status), tabel "Perjalanan Paket" (terbaru di atas).
- Status error (400/404/502/501) menampilkan pesan `error` dari respon.
- Permalink `#/resi?courier=<kode>&awb=<resi>`: saat tab dibuka dengan parameter itu, langsung cek; setelah pencarian, hash di-update via `history.replaceState`.

## Kriteria penerimaan
- [ ] Semua kasus di `cases.json` lulus via test Go yang membaca file tersebut.
- [ ] Handler `api` tidak mengimpor `store` secara langsung untuk tracking.
- [ ] Ada unit test registry: kurir tanpa provider → 501.

## Tasks
- [ ] `internal/provider`: interface, registry, `DummyProvider`.
- [ ] `api.track` memakai registry; tambah `source`; mapping error → status sesuai tabel.
- [ ] `internal/spectest` + test yang memuat `specs/001-tracking-provider/cases.json`.
- [ ] Ganti `TestTrack` tabel lama dengan cases dari spec (hindari duplikasi kasus).
- [ ] web: pindahkan UI cek resi yang ada ke `web/js/resi.js` + permalink `#/resi?...` (setelah kerangka tab dari 000 ada).
