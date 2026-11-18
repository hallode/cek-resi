# 004 — Cek ongkir

| | |
|---|---|
| Status | Implemented |
| Service pemilik | `ongkir-py` (Python) |
| Service lain yang tersentuh | `gateway-ts` (proxy prefix `/api/ongkir`), `web/` |
| Bergantung pada | 000 |
| Test vectors | [`cases.json`](cases.json) |

## Latar belakang
Selain cek resi, user ingin membandingkan ongkir antar kurir sebelum mengirim (seperti menu "Cek Ongkir" di cekresi.com). Semua tarif **dummy**, tapi rumusnya dibuat deterministik supaya bisa dites persis.

## Scope
- Masuk: daftar kota, kalkulasi ongkir dari asal/tujuan/berat (+ dimensi opsional), urutan termurah.
- Tidak masuk: tarif kurir asli, kecamatan/kode pos, asuransi, COD, diskon.

## Data dummy (konstanta di kode Python)

### Kota
| Kode | Nama | Pulau |
|---|---|---|
| `JKT` | Jakarta | Jawa |
| `BDG` | Bandung | Jawa |
| `SMG` | Semarang | Jawa |
| `YOG` | Yogyakarta | Jawa |
| `SBY` | Surabaya | Jawa |
| `MLG` | Malang | Jawa |
| `MDN` | Medan | Sumatera |
| `PLB` | Palembang | Sumatera |
| `DPS` | Denpasar | Bali |
| `BPN` | Balikpapan | Kalimantan |
| `MKS` | Makassar | Sulawesi |

### Zona
| Zona | Kondisi |
|---|---|
| `DALAM_KOTA` | asal = tujuan |
| `SATU_PULAU` | beda kota, pulau sama |
| `ANTAR_PULAU` | pulau berbeda |

### Tarif per kg (Rp) dan estimasi (hari)
| Kurir | Layanan | DALAM_KOTA | SATU_PULAU | ANTAR_PULAU | ETD DK | ETD SP | ETD AP |
|---|---|---|---|---|---|---|---|
| `sicepat` | `REG` | 8000 | 12000 | 25000 | 1–1 | 1–2 | 3–5 |
| `sicepat` | `BEST` | 12000 | 18000 | 35000 | 1–1 | 1–1 | 1–2 |
| `jne` | `REG` | 9000 | 13000 | 27000 | 1–2 | 2–3 | 3–5 |
| `jne` | `YES` | 15000 | 20000 | 40000 | 1–1 | 1–1 | 1–2 |
| `jnt` | `EZ` | 8500 | 12500 | 26000 | 1–2 | 2–3 | 3–6 |
| `anteraja` | `REG` | 7500 | 11500 | 24000 | 1–2 | 2–3 | 4–6 |
| `pos` | `KILAT` | 7000 | 11000 | 22000 | 2–3 | 3–4 | 5–7 |

## Kontrak API

### `GET /api/ongkir/cities`
`200` → `[{ "code": "JKT", "name": "Jakarta", "island": "Jawa" }, …]`, urut sesuai tabel kota.

### `GET /api/ongkir?origin=JKT&destination=BDG&weight=1500[&length=30&width=20&height=20]`
- `weight` dalam gram, integer 1..50000.
- `length`, `width`, `height` dalam cm, integer 1..200, opsional, tetapi **harus diisi ketiganya atau tidak sama sekali**.

`200`:
```json
{
  "origin": { "code": "JKT", "name": "Jakarta" },
  "destination": { "code": "BDG", "name": "Bandung" },
  "zone": "SATU_PULAU",
  "billable_weight_kg": 2,
  "options": [
    { "courier": "pos", "service": "KILAT", "price": 22000, "etd_days": { "min": 3, "max": 4 } }
  ]
}
```

| Kondisi | Status | `error` |
|---|---|---|
| `origin`/`destination`/`weight` kosong | 400 | `parameter origin, destination, dan weight wajib diisi` |
| kode asal tidak dikenal | 400 | `kota asal tidak dikenal` |
| kode tujuan tidak dikenal | 400 | `kota tujuan tidak dikenal` |
| `weight` bukan integer atau di luar 1..50000 | 400 | `weight harus bilangan bulat 1-50000 gram` |
| dimensi hanya sebagian diisi | 400 | `length, width, height harus diisi semua atau tidak sama sekali` |
| dimensi bukan integer atau di luar 1..200 | 400 | `dimensi harus bilangan bulat 1-200 cm` |

## Aturan perilaku
- **R1** — Kode kota dinormalisasi (trim + uppercase).
- **R2** — Berat tertagih dihitung dengan **aritmetika integer** (agar sama persis di semua bahasa):
  ```
  units = max(weight_g * 6, length * width * height)   # satuan 1/6000 kg
  billable_weight_kg = max(1, ceil_div(units, 6000))
  ```
  (setara `max(berat aktual kg, volumetrik p×l×t/6000)` lalu dibulatkan ke atas, minimal 1 kg.)
- **R3** — `price = tarif_per_kg[kurir][layanan][zona] * billable_weight_kg`.
- **R4** — `options` diurutkan: `price` naik, lalu `courier` alfabetis, lalu `service` alfabetis.
- **R5** — Semua layanan di tabel tarif selalu tersedia untuk semua zona.
- **R6** — Parameter yang tidak dikirim **atau berisi string kosong** dianggap tidak diisi (berlaku juga untuk `length`/`width`/`height`).
- **R7** — `weight`, `length`, `width`, `height` diparse **ketat**: nilai mentah (tanpa trim) harus cocok `^[0-9]+$`, lalu dicek rentangnya. Jadi `1_000`, `+5`, `-5`, `1.5`, ` 5`, dan `abc` semuanya tidak valid. (Kode kota tetap di-trim, lihat R1.)
- **R8** — Urutan validasi; error pertama yang kena dikembalikan: (1) `origin`/`destination`/`weight` tidak diisi → (2) kota asal tidak dikenal → (3) kota tujuan tidak dikenal → (4) `weight` tidak valid → (5) dimensi terisi sebagian → (6) dimensi tidak valid.

## UI
- Tab **"Cek Ongkir"**: dropdown asal & tujuan (dari `/api/ongkir/cities`), input berat (gram), dimensi opsional (bisa dibuka/tutup).
- Hasil berupa tabel: Kurir | Layanan | Estimasi | Harga (format `Rp 22.000`), baris termurah diberi label "Termurah".

## Kriteria penerimaan
- [ ] `cases.json` lulus via `pytest` (memakai `TestClient` FastAPI, membaca file spec).
- [ ] Unit test `billable_weight_kg` untuk batas: 1 g, 1000 g, 1001 g, 50000 g, volumetrik > aktual.
- [ ] Gateway mem-proxy `/api/ongkir*` (cases bisa dijalankan juga via gateway).

## Tasks
- [ ] ongkir-py: `app/data.py` (kota, tarif), `app/pricing.py` (R2–R4, fungsi murni), `app/main.py` (FastAPI, validasi, error sesuai tabel). Terima query param sebagai `str | None` lalu validasi manual — validasi otomatis FastAPI menghasilkan 422 dengan format berbeda dari K2.
- [ ] ongkir-py: `tests/spectest.py` + `tests/test_spec.py`, `tests/test_pricing.py`.
- [ ] gateway-ts: proxy prefix `/api/ongkir` → `ONGKIR_URL`.
- [ ] web: tab Cek Ongkir.
