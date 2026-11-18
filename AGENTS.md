# AGENTS.md

Panduan untuk coding agent (dan manusia) di monorepo ini.

## Ringkasan

Aplikasi web cek resi paket multi-kurir (referensi UI: https://cekresi.com/top/), dibangun sebagai monorepo polyglot: **satu service per bahasa**. **Semua data dummy** — jangan memanggil API kurir asli, scraping, atau layanan eksternal kecuali diminta eksplisit.

## Service

| Service | Bahasa | Port | Tugas | Status |
|---|---|---|---|---|
| [`gateway-ts`](services/gateway-ts/AGENTS.md) | TypeScript (Node 24) | 8080 | serve `web/`, proxy `/api/*` ke service lain | tracking, ongkir & deteksi (002) jalan; bulk (003) termasuk tab Banyak Resi |
| [`tracking-go`](services/tracking-go/AGENTS.md) | Go | 8081 | data resi & kurir (SQLite dummy) | jalan (spec 001 belum penuh) |
| [`detect-rust`](services/detect-rust/AGENTS.md) | Rust (axum) | 8082 | deteksi kurir dari nomor resi | jalan (spec 002) |
| [`ongkir-py`](services/ongkir-py/AGENTS.md) | Python (FastAPI) | 8083 | kalkulasi ongkir | jalan (spec 004 terimplementasi) |

`web/` = frontend statis (HTML/CSS/vanilla JS, tanpa build step), diserve gateway. Browser hanya bicara ke gateway.

## Spec-driven

Perilaku didefinisikan di [`specs/`](specs/README.md) sebelum diimplementasikan.

- **Jangan menulis fitur baru tanpa spec.** Ubah `spec.md` + `cases.json` dulu, baru kode.
- Test wajib membaca `cases.json` (lewat harness `spectest` tiap bahasa), jangan menyalin kasusnya ke kode test.
- Kode berbeda dari spec = bug. Kalau tidak jelas mana yang benar, tanya user.
- Setelah selesai, update Status di [specs/README.md](specs/README.md) dan header spec.

## Perintah (semua lewat [mise](https://mise.jdx.dev))

```sh
mise install                 # toolchain ter-pin: Go, Node, Rust, Python, uv
mise run setup               # install dependency semua service
mise run dev                 # jalankan semua → http://localhost:8080
mise run test | lint | fmt   # semua service
mise run test:detect         # satu service: <aksi>:<tracking|gateway|detect|ongkir>
mise run scan                # cek kerentanan dependency ke osv.dev (butuh jaringan; spec 006)
mise run e2e                 # specs/*/cases.e2e.json ke gateway (butuh `mise run dev`)
```

Versi toolchain ada di [`mise.toml`](mise.toml) — ubah di sana, bukan di tiap service.

## Aturan lintas-service

- Service hanya bicara lewat HTTP JSON sesuai spec. Tidak ada import kode lintas service, tidak ada DB bersama.
- Gateway meneruskan path publik **apa adanya** ke service pemilik (`ROUTES` di `services/gateway-ts/src/app.ts`).
- Konvensi HTTP/JSON, kurir kanonik, dan aturan A1–A6 ada di [spec 000](specs/000-architecture/spec.md).
- Dependency minimal; prefer stdlib. Jangan tambah dependency tanpa alasan kuat.

## Kontrak service (checklist service baru)

1. `services/<nama>/AGENTS.md` sendiri.
2. `GET /health` → `{"status":"ok","service":"<nama>"}`; port dari env `PORT`.
3. Task `setup|dev|test|lint|fmt:<alias>` di `mise.toml` + masuk daftar service di atas.
4. Harness `matchPartial` + loader `cases.json` (contoh: `internal/spectest`, `src/spectest.ts`, `tests/spectest/`, `tests/spectest.py`), divalidasi oleh [`specs/matcher-cases.json`](specs/matcher-cases.json).
5. Spec dimuat lewat daftar eksplisit `SPEC_FILES` di test service; tambahkan entri saat spec-nya diimplementasikan.

## Cara kerja agen

Berlaku untuk semua agen. Versi lengkap ada di `.claude/skills/` (diadaptasi dari [ponytail](https://github.com/dietrichgebert/ponytail), MIT).

- **Perubahan terkecil yang lengkap** (skill `ponytail`): pakai yang sudah ada di repo → stdlib/platform → dependency terpasang → baru tulis kode; tanpa abstraksi atau fitur yang tidak diminta. Malas pada solusi, bukan pada perubahan: pemanggil, test, `cases.json`, dan status spec ikut diselesaikan.
- **Jangan dipotong:** validasi di batas kepercayaan, format error `{"error": ...}`, keamanan (tidak mencatat nomor resi di log, `textContent` bukan `innerHTML`), aksesibilitas, dan status spec yang jujur.
- **Tutup tiap balasan** dengan satu atau dua baris: apa yang dilewati atau tidak diperiksa, dan risikonya. Jangan melaporkan hasil yang tidak kamu lihat sendiri (lint/test dijalankan dan dibaca, bukan diasumsikan).
- **Review** (skill `review-code`): read-only; temuan diverifikasi dan diberi label CONFIRMED/PLAUSIBLE; format Must fix / Should fix / Nice to have dengan `file:baris`.
- **Tiga peran** (skill `dev-flow`, agen di `.claude/agents/`): planner (read-only) → executor → reviewer (independen, hanya diberi diff dan spec). Pengaturan model/tool/level ada di tabel `dev-flow` dan frontmatter tiap agen.
- `mise run scan` (kirim daftar paket ke osv.dev) dan aksi keluar (komentar/merge PR, push) hanya atas permintaan atau izin yang jelas.

## Definition of done

`mise run lint` dan `mise run test` hijau; kontrak/spec masih akurat; kalau UI berubah, cek manual lewat `mise run dev`.
