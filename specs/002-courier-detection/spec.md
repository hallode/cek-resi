# 002 — Deteksi kurir otomatis

| | |
|---|---|
| Status | Draft |
| Service pemilik | `detect-rust` (Rust) |
| Service lain yang tersentuh | `gateway-ts` (track tanpa kurir), `web/` |
| Bergantung pada | 000, 001 |
| Test vectors | [`cases.json`](cases.json) (`level: service`), [`cases.e2e.json`](cases.e2e.json) (`level: e2e`) |

## Latar belakang
User sering tidak tahu atau malas memilih kurir. Format nomor resi tiap kurir punya pola khas, jadi kurir bisa ditebak dari resinya. Kalau tebakannya ambigu, sistem mencoba semua kandidat secara berurutan.

## Scope
- Masuk: `GET /api/detect` di detect-rust; `GET /api/track` tanpa `courier` di gateway; UI pilihan "Otomatis".
- Tidak masuk: machine learning, checksum resi, pola kurir asli yang presisi (pola di bawah **dummy** dan cukup untuk data seed).

## Kontrak API

### `GET /api/detect?awb=<resi>` (detect-rust)
`200`:
```json
{
  "awb": "004000123456",
  "candidates": [
    { "code": "sicepat", "confidence": "high" },
    { "code": "tiki", "confidence": "low" }
  ]
}
```

| Kondisi | Status | `error` |
|---|---|---|
| `awb` kosong (setelah trim) | 400 | `parameter awb wajib diisi` |
| panjang `awb` > 40 karakter (setelah trim) | 400 | `awb terlalu panjang` |
| tidak ada pola yang cocok | 200 | — (`candidates: []`) |

### `GET /api/track?awb=<resi>` tanpa `courier` (gateway-ts)
Jika `courier` kosong, gateway:
1. memanggil `GET {DETECT_URL}/api/detect?awb=…`;
2. mencoba `GET {TRACKING_URL}/api/track?courier=<kandidat>&awb=…` untuk tiap kandidat **berurutan**;
3. respon `200` pertama dikembalikan apa adanya dengan tambahan field `"detected": true`.

| Kondisi | Status | `error` |
|---|---|---|
| `candidates` kosong | 400 | `kurir tidak terdeteksi, pilih kurir secara manual` |
| semua kandidat 404 | 404 | `resi tidak ditemukan` |
| detect-rust tidak bisa dihubungi | 502 | `layanan deteksi tidak tersedia` |

Jika `courier` diisi, gateway hanya proxy biasa ke tracking-go (perilaku 001, tanpa field `detected`).

## Aturan perilaku
- **R1** — `awb` dinormalisasi (trim + uppercase) sebelum dicocokkan; respon memakai `awb` yang sudah dinormalisasi.
- **R2** — Pola dicocokkan terhadap seluruh string (anchored `^…$`).
- **R3** — Urutan kandidat: `high` dulu baru `low`, lalu kode kurir alfabetis.
- **R4** — Tabel pola (dummy, tetapkan di kode Rust sebagai konstanta):

| Kurir | Pola | Confidence | Contoh |
|---|---|---|---|
| `sicepat` | `^00\d{10}$` | high | `004000123456` |
| `tiki` | `^\d{12}$` | low | `660000000001` |
| `jne` | `^[A-Z]{3}\d[A-Z]\d{8}$` | high | `CGK1A00012345` |
| `jnt` | `^JP\d{10}$` | high | `JP1234567890` |
| `jntcargo` | `^JC\d{10}$` | high | `JC1234567890` |
| `spx` | `^SPXID\d{12}$` | high | `SPXID041234567890` |
| `lion` | `^\d{2}LP\d{10}$` | high | `11LP1234567890` |
| `pos` | `^P\d{13}$` | high | `P2211000123456` |
| `anteraja` | `^1000\d{10}$` | high | `10001234567890` |
| `indah` | `^IND\d{9}$` | high | `IND123456789` |

- **R5** — Kode kurir di tabel harus subset dari kurir kanonik (000). Test Rust memastikan setiap contoh di tabel terdeteksi ke kurirnya.

## UI
- Tombol kurir pertama: **"Otomatis"** (default terpilih) → request `GET /api/track?awb=…` tanpa `courier`.
- Jika respon punya `detected: true`, tampilkan label kecil "Kurir terdeteksi otomatis: <nama>" dan tandai tombol kurir yang sesuai.
- Jika error "kurir tidak terdeteksi…", tampilkan pesannya dan biarkan user memilih kurir manual.

## Kriteria penerimaan
- [ ] `cases.json` lulus di `cargo test` (test membaca file via `include_str!`).
- [ ] `cases.e2e.json` lulus via gateway dengan tracking-go + detect-rust hidup.
- [ ] Contoh di tabel R4 = test unit tambahan di Rust.

## Tasks
- [ ] detect-rust: `src/patterns.rs` (tabel R4, `regex` dikompilasi sekali via `LazyLock`), handler `/api/detect`, `/health`.
- [ ] detect-rust: `tests/spec.rs` + `matchPartial`.
- [ ] gateway-ts: cabang `track` tanpa courier (R1–R3 pada sisi gateway), env `DETECT_URL`.
- [ ] web: tombol "Otomatis", label hasil deteksi.
