# 003 — Cek banyak resi + permalink

| | |
|---|---|
| Status | Draft |
| Service pemilik | `gateway-ts` (TypeScript) |
| Service lain yang tersentuh | `tracking-go`, `detect-rust` (dipanggil), `web/` |
| Bergantung pada | 001, 002 |
| Test vectors | [`cases.e2e.json`](cases.e2e.json) (`level: e2e`), [`cases.json`](cases.json) (`level: service`, validasi tanpa upstream) |

## Latar belakang
Seller online mengecek banyak resi sekaligus. Daripada memanggil API satu per satu, gateway menyediakan satu endpoint agregasi yang memakai tracking (001) dan deteksi (002), plus permalink supaya hasil bisa dibagikan.

## Scope
- Masuk: `POST /api/track/bulk`, textarea multi-resi di UI, permalink `?courier=&awb=` dan `?awb=A,B,C`.
- Tidak masuk: upload CSV, export, notifikasi perubahan status.

## Kontrak API

### `POST /api/track/bulk`
Request:
```json
{
  "items": [
    { "awb": "004000123456", "courier": "sicepat" },
    { "awb": "JP1234567890" }
  ]
}
```
`courier` opsional per item; jika kosong, kurir dideteksi seperti 002.

`200` (selalu 200 jika request valid, walaupun sebagian item gagal):
```json
{
  "results": [
    {
      "awb": "004000123456",
      "courier": "sicepat",
      "detected": false,
      "ok": true,
      "status": "DELIVERED",
      "last_event": { "time": "2026-11-11T13:47:00+07:00", "location": "Bandung", "description": "…" }
    },
    {
      "awb": "ZZZ",
      "courier": null,
      "detected": false,
      "ok": false,
      "error": "kurir tidak terdeteksi, pilih kurir secara manual"
    }
  ]
}
```

Field item hasil:

| Field | Tipe | Keterangan |
|---|---|---|
| `awb` | string | sudah dinormalisasi |
| `courier` | string \| null | kode kurir yang dipakai; `null` jika tidak ada kurir yang bisa dipakai |
| `detected` | bool | `true` jika kurir didapat dari deteksi (item tanpa `courier`) **dan** berhasil |
| `ok` | bool | |
| `status` | string | hanya jika `ok` |
| `last_event` | object | hanya jika `ok`; = `history[0]` dari tracking, tidak ada jika history kosong |
| `error` | string | hanya jika `!ok`; pesan dari aturan R5 |

Error level request (400):

| Kondisi | `error` |
|---|---|
| body bukan JSON / tidak punya array `items` | `body harus JSON dengan field items` |
| `items` kosong | `items wajib diisi` |
| `items` > 10 setelah dedup | `maksimal 10 resi per permintaan` |
| ada item dengan `awb` kosong | `setiap item wajib punya awb` |

## Aturan perilaku
- **R1** — Normalisasi tiap item sesuai K3.
- **R2** — Dedup: item dengan pasangan (`courier` ternormalisasi atau kosong, `awb`) yang sama digabung; yang dipertahankan kemunculan pertama. Batas 10 dihitung **setelah** dedup.
- **R3** — Urutan `results` = urutan item setelah dedup.
- **R4** — Item diproses paralel dengan maksimal 5 request upstream bersamaan; timeout per request upstream 3 detik (A5).
- **R5** — Pesan error per item:
  - tracking 404 / semua kandidat 404 → `resi tidak ditemukan`
  - tracking 400 `kurir tidak dikenal` → `kurir tidak dikenal`
  - deteksi tanpa kandidat → `kurir tidak terdeteksi, pilih kurir secara manual`
  - timeout / koneksi gagal / 5xx → `layanan sedang tidak tersedia`
- **R6** — Saat item gagal, `courier` diisi kode yang dikirim user (jika ada), selain itu `null`.
- **R7** — Logika "deteksi lalu coba kandidat" dipakai bersama oleh `GET /api/track` (002) dan bulk; implementasikan sekali di gateway (`src/resolve.ts`).

## UI & permalink
Mengikuti aturan frontend satu halaman di [000](../000-architecture/spec.md#frontend-satu-halaman-satu-tab-per-fitur) (F1–F7).

- Tab **"Banyak Resi"** (`#/bulk`): textarea (satu resi per baris, atau dipisah koma/spasi), kurir opsional (pakai pilihan kurir aktif, atau "Otomatis").
- Hasil berupa tabel ringkas: Resi | Kurir | Status (badge) | Update terakhir | aksi "Detail" yang berpindah ke tab Cek Resi untuk resi itu (F7).
- Permalink (hash route):
  - `#/resi?courier=sicepat&awb=004000123456` → saat load, langsung cek resi tunggal (tab Cek Resi).
  - `#/bulk?awb=004000123456,JP1234567890` → langsung cek banyak (kurir otomatis).
  - Setelah pencarian, hash di-update via `history.replaceState`, lalu tombol **"Salin link"** menyalin URL lengkap.

## Kriteria penerimaan
- [ ] `cases.json` lulus via `node --test` tanpa upstream (validasi request saja).
- [ ] `cases.e2e.json` lulus dengan semua service hidup.
- [ ] Unit test `resolve.ts` dengan upstream tiruan: timeout → `layanan sedang tidak tersedia`; batas konkurensi 5 dipatuhi.

## Tasks
- [ ] gateway-ts: `src/resolve.ts` (dipakai 002 & 003), `src/bulk.ts`, route `POST /api/track/bulk`.
- [ ] gateway-ts: limiter konkurensi sederhana (tanpa dependency).
- [ ] web: tab Banyak Resi, tabel hasil, permalink, tombol salin link.
