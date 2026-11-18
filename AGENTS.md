# AGENTS.md

Aplikasi cek resi multi-kurir (data **dummy**; jangan memanggil API kurir asli atau layanan eksternal tanpa diminta). Monorepo polyglot, satu service per bahasa, spec-driven.

## Hemat konteks: baca seperlunya
1. **Mulai dari Peta konteks di bawah**, baca hanya baris yang cocok dengan tugas. Jangan me-list atau membaca seluruh repo/folder.
2. **Cari dulu, baru baca.** Grep nama fungsi/route/kasus yang spesifik; baca file yang ketemu. File panjang (>300 baris) dibaca per bagian.
3. **Lintas service lewat kontrak, bukan kode.** Untuk service lain cukup spec-nya (`specs/`), jangan membaca implementasinya.
4. **Jangan baca:** lockfile (`uv.lock`, `package-lock.json`, `Cargo.lock`, `go.sum`), `*.db`, folder build (`node_modules/`, `target/`, `.venv/`), arsip `plans/`, dan output test penuh (pakai `tail`/`grep`).
5. Aturan detail tiap folder ada di `AGENTS.md` folder itu dan dimuat saat folder itu disentuh, jadi tidak perlu dibuka di awal.
6. Berhenti membaca begitu cukup untuk bertindak. Subagent diberi path spesifik, bukan "jelajahi repo".

## Peta konteks
| Tugas | Baca (urut, hanya ini) |
|---|---|
| Perilaku API berubah | `specs/README.md` (cari nomor spec) → spec itu → `services/<svc>/AGENTS.md` → file yang ditunjuk |
| Data resi/kurir dummy, endpoint tracking | `services/tracking-go/AGENTS.md` (bagian Resep) |
| Pola deteksi kurir | `services/detect-rust/src/patterns.rs` + spec 002 R4 |
| Tarif/kota ongkir | `services/ongkir-py/app/data.py`, `pricing.py` + spec 004 |
| Route publik / proxy / bulk | `services/gateway-ts/AGENTS.md` → `src/app.ts` (`ROUTES`) + spec 000 A1–A6 |
| UI / frontend | `web/AGENTS.md` → `web/js/<tab>.js` terkait → bagian spec 005 yang relevan |
| Toolchain / task | `mise.toml` |
| Model/effort agen | `.claude/agents.toml` lalu `mise run agents:sync` |
| Tambah service baru | spec 000 + checklist di bawah |
| Review | skill `review-code`: diff + spec terkait + pemanggil (via grep) |
| Pertanyaan sempit soal kode | subagent `explorer` (jawaban + `file:baris`), bukan membaca banyak file sendiri |

## Service
| Service | Bahasa | Port | Tugas |
|---|---|---|---|
| `services/gateway-ts` | TypeScript (Node 24) | 8080 | serve `web/`, proxy `/api/*`, bulk tracking |
| `services/tracking-go` | Go | 8081 | data resi & kurir (SQLite dummy) |
| `services/detect-rust` | Rust (axum) | 8082 | deteksi kurir dari nomor resi |
| `services/ongkir-py` | Python (FastAPI) | 8083 | kalkulasi ongkir |

Browser hanya bicara ke gateway. Service bicara lewat HTTP JSON sesuai spec: tanpa import kode lintas service, tanpa DB bersama. Konvensi HTTP/JSON (K1–K5), kurir kanonik, dan aturan A1–A6 ada di spec 000.

## Spec-driven
- Tanpa spec tidak ada fitur. Ubah `spec.md` + `cases.json` dulu, baru kode.
- Test membaca `cases.json` lewat harness `spectest` (daftar `SPEC_FILES` di test service); jangan menyalin kasus ke kode test.
- Kode berbeda dari spec = bug; kalau tidak jelas mana yang benar, tanya user. Status di `specs/README.md` dan header spec harus jujur.

## Perintah (mise)
```sh
mise install && mise run setup   # toolchain ter-pin + dependency
mise run dev                     # semua service → http://localhost:8080
mise run test | lint | fmt       # semua; satu service: test:<tracking|gateway|detect|ongkir>
mise run e2e                     # specs/*/cases.e2e.json ke gateway (butuh `mise run dev`)
mise run scan                    # osv.dev (kirim daftar paket ke luar; hanya bila diminta)
mise run agents:sync             # terapkan .claude/agents.toml ke definisi agen
```

## Cara kerja agen
Detail di `.claude/skills/` (diadaptasi dari [ponytail](https://github.com/dietrichgebert/ponytail), MIT).
- **Perubahan terkecil yang lengkap** (skill `ponytail`): reuse repo → stdlib → dependency terpasang → baru kode baru. Pemanggil, test, `cases.json`, dan status spec ikut diselesaikan.
- **Jangan dipotong:** validasi batas kepercayaan, error `{"error": ...}`, keamanan (nomor resi tidak masuk log, `textContent` bukan `innerHTML`), aksesibilitas.
- **Alur default tugas coding non-sepele** (skill `dev-flow`): subagent planner membuat rencana → user menyetujui → subagent executor mengerjakan → user ditanya mau review → subagent reviewer; subagent explorer untuk pertanyaan sempit. Model/effort tiap subagent dari `.claude/agents.toml` (jangan override saat memanggil). Review (skill `review-code`) read-only dengan temuan terverifikasi.
- Jangan melaporkan hasil yang tidak kamu lihat; tutup balasan dengan apa yang dilewati dan risikonya. Push, komentar/merge PR, dan `mise run scan` hanya atas izin jelas.

## Checklist service baru
`services/<nama>/AGENTS.md` + `CLAUDE.md` (symlink ke `AGENTS.md`) · `GET /health` dan env `PORT` · task `setup|dev|test|lint|fmt:<alias>` di `mise.toml` · harness spectest divalidasi `specs/matcher-cases.json` · baris di tabel Service dan Peta konteks.

## Definition of done
`mise run lint` dan `mise run test` hijau; spec dan status akurat; UI berubah → cek manual lewat `mise run dev`.
