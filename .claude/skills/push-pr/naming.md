# Konvensi nama cek-resi

Satu-satunya sumber konvensi nama: kode, kontrak, web, SQL, branch, dan commit. Skill lain (`dev-flow`, `push-pr`) dan `AGENTS.md` merujuk ke sini. Berlaku saat menulis kode dan dicek oleh `push-pr` sebelum push. Yang ditandai **lint** sudah ditegakkan otomatis oleh `mise run lint`; sisanya dicek manual dari diff.

## Branch
Setiap pekerjaan yang mengubah file dikerjakan di branch baru dari `master` (cara membuatnya: `dev-flow`, bagian Branch).

| Prefix | Dipakai untuk |
|---|---|
| `feat/<nnn>-<nama>` | fitur baru atau perubahan perilaku (`nnn` = nomor spec, wajib) |
| `hotfix/<nama>` | `dev-flow mode=hotfix` |
| `fix/<nama>` | perbaikan bug lewat alur normal |
| `refactor/<nama>` | refaktor tanpa perubahan perilaku |
| `chore/<nama>` | tooling, config, dependency, agen/skill |
| `docs/<nama>` | dokumen/spec tanpa perubahan perilaku |

`<nama>` kebab-case, maksimal 40 karakter; nama sudah ada → tambah `-2`, `-3`. Regex:
`^(feat/[0-9]{3}-|(hotfix|fix|refactor|chore|docs)/)[a-z0-9]+(-[a-z0-9]+)*$`

## Commit dan PR
- Subject: bahasa Inggris, kalimat perintah, huruf pertama kapital, maksimal 72 karakter, tanpa titik di akhir. Sebut spec bila ada: `Implement spec 002: automatic courier detection`, `Add bulk tracking to gateway-ts (spec 003)`.
- Body opsional (baris maksimal 72 karakter): *apa* dan *kenapa* per service.
- Judul PR = subject commit utama.

## Umum
- **Bahasa:** nama, komentar, commit, PR dalam bahasa Inggris. Teks yang tampil ke user (UI, `{"error": ...}`) dalam bahasa Indonesia.
- **Istilah domain tetap:** `awb` (nomor resi), `courier`, `shipment`, `history`, `status`, `ongkir`, `city`, `zone`, `tariff`. Jangan sinonim baru di kode (`resi`, `trackingNumber`, `expedition`, `receipt`). Pengecualian: id tab/route UI `resi`, `bulk`, `ongkir`.
- **Singkatan** hanya yang sudah umum di repo: `awb`, `cfg`, `ctx`, `err`, `req`, `res`, `url`. Satuan di akhir nama: `timeoutMs`, `REQUEST_TIMEOUT_MS`, `weight_kg`.
- **Boolean:** awalan `is`/`has` (`isAutoTrack`, `hasOwn`).

## Kontrak lintas service (spec 000)
Mengganti nama di bagian ini = **breaking change** (lihat langkah 5 `push-pr`).

| Hal | Konvensi | Contoh |
|---|---|---|
| Field JSON, query param | `snake_case` (K4) | `billable_weight_kg`, `?courier=&awb=` |
| Kode kurir | lowercase kanonik (spec 000) | `sicepat`, `jntcargo` |
| Nilai enum di JSON | `UPPER_SNAKE` | `IN_TRANSIT`, `OUT_FOR_DELIVERY` |
| Path API | `/api/<resource>` huruf kecil, `-` bila perlu | `/api/track/bulk`, `/api/ongkir/cities` |
| Env var | `UPPER_SNAKE`; upstream `<NAMA>_URL` | `PORT`, `DETECT_URL`, `DB_PATH` |
| Service | `<domain>-<bahasa>` | `detect-rust`, `ongkir-py` |
| Task mise | `<aksi>:<alias>` | `test:detect`, `dev:gateway` |
| Folder spec | `NNN-kebab-slug` | `002-courier-detection` |
| File kasus | `cases.json` (service), `cases.e2e.json` (e2e) | |
| `name` kasus | kalimat pendek huruf kecil, unik per file (dipakai cek kompatibilitas) | `"jnt lowercase is normalized"` |

## Per bahasa

| | Go (`tracking-go`) | Rust (`detect-rust`) **lint** | TypeScript (`gateway-ts`) / JS (`web/js`) | Python (`ongkir-py`) **lint** (ruff `N`) |
|---|---|---|---|---|
| Fungsi, variabel | `mixedCaps`; ekspor `MixedCaps` | `snake_case` | `camelCase` | `snake_case`; privat diawali `_` (`_strict_int`) |
| Tipe | `MixedCaps` | `PascalCase`, varian enum `PascalCase` | `PascalCase` | `PascalCase` |
| Konstanta | `mixedCaps`/`MixedCaps` | `SCREAMING_SNAKE` (`TABLE`, `PATTERNS`) | tabel/konfigurasi modul `UPPER_SNAKE` (`ROUTES`, `MAX_AWBS`) | `UPPER_SNAKE`; pesan error `MSG_*` |
| Singkatan | huruf besar semua: `AWB`, `JSON`, `URL`, `ID` | seperti kata biasa: `Awb` | seperti kata biasa: `awb`, `toJson` | seperti kata biasa |
| Error | sentinel `ErrXxx` (`ErrNotFound`), bungkus `fmt.Errorf("ctx: %w", err)` | | | kelas `XxxError` (`RequestError`) |
| Bentuk JSON | struct `xxxJSON` di package `api` saja (`trackJSON`) | struct `XxxJson` + `serde` | key objek boleh `snake_case` bila meniru kontrak JSON | model/dict `snake_case` |
| File | huruf kecil, `_test.go` | `snake_case.rs` | huruf kecil satu kata (`track.ts`, `resi.js`); test `*.test.ts` | `snake_case.py`; test `test_*.py` |
| Package/modul | satu kata huruf kecil (`store`, `api`) | `snake_case` | | `snake_case` |

## Web (`web/`)
- Kelas CSS `kebab-case`, bagian komponen `<blok>-<bagian>` (`bulk-table`, `chip-group`), state `is-*` (`is-active`, `is-detected`).
- `id` dan atribut `data-*` `kebab-case` (`track-form`, `awb-error`, `data-view`).
- Kunci `localStorage`: `cekresi.<nama>` atau `cekresi.<tab>.<nama>` (`cekresi.bulk.courier`). Mengganti kunci = data user lama hilang; perlakukan sebagai breaking (lihat `LEGACY_COURIER_KEY` untuk pola migrasi).
- Route hash `#/<tab>?<param>`; modul per tab `web/js/<tab>.js`.

## SQL (`tracking-go/internal/store`)
Tabel jamak `snake_case` (`tracking_events`), kolom `snake_case`, waktu `<x>_at` (`occurred_at`), relasi `<x>_code`.
