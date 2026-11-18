# 003 — Cek banyak resi + permalink

| | |
|---|---|
| Status | Draft (gateway-ts sudah ada; e2e menunggu 002; UI `js/bulk.js` belum) |
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

Error level request, dicek **berurutan**; yang pertama cocok menang:

| # | Kondisi | Status | `error` |
|---|---|---|---|
| 1 | body > 64 KiB | 413 | `body terlalu besar` |
| 2 | body bukan JSON object, `items` bukan array, ada item yang bukan object, atau `awb`/`courier` bukan string (`null`/tidak ada = kosong) | 400 | `body harus JSON dengan field items` |
| 3 | `items` kosong | 400 | `items wajib diisi` |
| 4 | (normalisasi R1, lalu dedup R2 — item `awb` kosong ikut di-dedup) | | |
| 5 | ada item dengan `awb` kosong | 400 | `setiap item wajib punya awb` |
| 6 | `items` > 10 setelah dedup | 400 | `maksimal 10 resi per permintaan` |

## Aturan perilaku
- **R1** — Normalisasi tiap item sesuai K3.
- **R2** — Dedup: item dengan pasangan (`courier` ternormalisasi atau kosong, `awb`) yang sama digabung; yang dipertahankan kemunculan pertama. Item dengan `awb` kosong ikut di-dedup. Batas 10 dihitung **setelah** dedup.
- **R3** — Urutan `results` = urutan item setelah dedup.
- **R4** — Item diproses paralel. Batas konkurensi dihitung per **HTTP call ke upstream** (deteksi maupun tracking), maksimal 5 bersamaan dalam satu request bulk. Kandidat dalam satu item tetap dicoba berurutan (002). Timeout per HTTP call 3 detik (A5).
- **R5** — Pemetaan respon upstream → pesan error per item:

  | Respon upstream | `error` |
  |---|---|
  | tracking 404 | `resi tidak ditemukan` |
  | tracking 400 `kurir tidak dikenal` | `kurir tidak dikenal` |
  | tracking 501 | `kurir belum didukung` |
  | tracking 4xx lain | `permintaan tidak valid` |
  | deteksi 200 dengan `candidates: []` | `kurir tidak terdeteksi, pilih kurir secara manual` |
  | deteksi 400 `awb terlalu panjang` | `awb terlalu panjang` |
  | deteksi 4xx lain | `permintaan tidak valid` |
  | timeout / koneksi gagal / 5xx selain 501 / body bukan JSON | `layanan sedang tidak tersedia` |

- **R5a** — Item tanpa `courier` mencoba kandidat berurutan; kandidat pertama yang `200` menang. Jika tidak ada yang `200`, error dipilih dengan prioritas:
  1. ada kandidat yang `layanan sedang tidak tersedia` → itu (resi mungkin ada di layanan yang sedang down, jadi "tidak ditemukan" bisa menyesatkan);
  2. semua kandidat 404 → `resi tidak ditemukan`;
  3. selain itu → pesan kandidat pertama yang bukan 404.
- **R6** — Saat item gagal, `courier` diisi kode yang dikirim user (jika ada), selain itu `null`.
- **R7** — Logika "deteksi lalu coba kandidat" dipakai bersama oleh `GET /api/track` (002) dan bulk; implementasikan sekali di gateway (`src/resolve.ts`). Untuk `GET /api/track` tanpa `courier`, hasil resolve dipetakan ke status HTTP: tidak ada kandidat → 400, semua 404 → 404, `awb terlalu panjang` → 400, `kurir tidak dikenal` → 400, `kurir belum didukung` → 501, deteksi down → 502 `layanan deteksi tidak tersedia`, tracking down → 502 `layanan tracking tidak tersedia` (A5).

## UI & permalink
Mengikuti aturan frontend satu halaman di [000](../000-architecture/spec.md#frontend-satu-halaman-satu-tab-per-fitur) (F1–F7).

- Tab **"Banyak Resi"** (`#/bulk`): textarea (satu resi per baris, atau dipisah koma/spasi), pilihan kurir berupa dropdown "Otomatis" (default) + daftar kurir. Kurir yang dipilih dipakai untuk semua item.
- Hasil berupa tabel ringkas: Resi | Kurir | Status (badge) | Update terakhir | aksi "Detail" yang berpindah ke tab Cek Resi untuk resi itu (F7).
- Permalink (hash route):
  - `#/resi?courier=sicepat&awb=004000123456` → saat load, langsung cek resi tunggal (tab Cek Resi).
  - `#/bulk?awb=004000123456,JP1234567890` → langsung cek banyak (kurir otomatis).
  - `#/bulk?courier=jne&awb=A,B` → cek banyak dengan kurir itu untuk semua item. Tab ditentukan oleh hash, bukan jumlah resi: `#/bulk?awb=X` (satu resi) tetap tab Banyak Resi.
  - Setelah pencarian, hash di-update via `history.replaceState`, lalu tombol **"Salin link"** menyalin URL lengkap.

## Kriteria penerimaan
- [x] `cases.json` lulus via `node --test` tanpa upstream (validasi request saja).
- [ ] `cases.e2e.json` lulus dengan semua service hidup. (Sudah lulus dengan tracking Go asli + detect tiruan; menunggu `detect-rust` dari 002.)
- [x] Unit test `resolve.ts` dengan upstream tiruan: timeout → `layanan sedang tidak tersedia`; batas konkurensi 5 dipatuhi.

## Tasks
- [x] gateway-ts: `src/resolve.ts` (dipakai 002 & 003), `src/bulk.ts`, route `POST /api/track/bulk`.
- [x] gateway-ts: limiter konkurensi sederhana (tanpa dependency).
- [ ] web: `js/bulk.js` — tab Banyak Resi, tabel hasil, permalink `#/bulk`, tombol salin link (kerangka tab 000 sudah ada; tampilan ikut 005).
