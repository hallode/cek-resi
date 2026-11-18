# 006 — Pemindaian keamanan dependency (OSV)

| | |
|---|---|
| Status | Draft (task terpasang; scan awal belum dijalankan) |
| Pemilik | repo (lintas service); tidak ada kode service |
| Service lain yang tersentuh | semua (membaca lockfile masing-masing) |
| Bergantung pada | 000 |
| Test vectors | tidak ada `cases.json` (tidak ada kontrak HTTP); verifikasi lewat [Kriteria penerimaan](#kriteria-penerimaan) |

## Latar belakang
Tiap service punya ekosistem dependency sendiri (Go, npm, Cargo, uv). Kerentanan yang diketahui publik perlu terdeteksi sebelum kode digabung. [OSV](https://osv.dev) adalah basis data kerentanan terbuka yang mencakup keempat ekosistem; `osv-scanner` mencocokkan lockfile repo dengan basis data itu.

## Scope
- Masuk: pemindaian lockfile semua service lewat `osv-scanner`, task `mise run scan`, versi scanner ter-pin, konfigurasi pengecualian yang terdokumentasi.
- Tidak masuk: pemindaian image/container (belum ada Docker), pemindaian kode sumber (SAST), perbaikan otomatis (Dependabot), CI (menyusul bersama CI di 000).

## Sumber yang dipindai

| Service | Ekosistem | Berkas |
|---|---|---|
| `tracking-go` | Go | `services/tracking-go/go.mod` (versi modul + `go.sum`) |
| `gateway-ts` | npm | `services/gateway-ts/package-lock.json` |
| `detect-rust` | crates.io | `services/detect-rust/Cargo.lock` |
| `ongkir-py` | PyPI | `services/ongkir-py/uv.lock` |

## Aturan perilaku
- **S1** — `mise run scan` memindai semua lockfile di bawah `services/` secara rekursif dan keluar dengan kode ≠ 0 bila ada kerentanan yang belum dikecualikan.
- **S2** — Versi `osv-scanner` di-pin di `mise.toml` (sama seperti toolchain lain).
- **S3** — Scan butuh jaringan ke `api.osv.dev`; hanya daftar paket + versi yang dikirim, bukan kode sumber. Task ini **tidak** ikut `mise run lint` atau `mise run test`, supaya kedua perintah itu tetap bisa jalan offline dan tidak gagal karena kerentanan baru yang bukan akibat perubahan kode.
- **S4** — Pengecualian hanya lewat `osv-scanner.toml` di root repo. Setiap entri **wajib** punya `id`, `ignoreUntil` (tanggal paling lama 90 hari ke depan), dan `reason` yang menjelaskan kenapa aman atau kenapa belum bisa diperbarui.
- **S5** — Tidak ada kerentanan di dependency langsung yang dibiarkan tanpa tindak lanjut: diperbarui, atau dikecualikan sesuai S4.

## Kriteria penerimaan
- [x] `mise run scan` berjalan dari root dan memindai keempat lockfile (keluaran menyebut keempat ekosistem).
- [ ] Hasil pemindaian awal terdokumentasi di PR/commit: temuan dan tindak lanjutnya.
- [x] `osv-scanner.toml` ada, dan setiap pengecualian memenuhi S4.
- [ ] `mise run lint` dan `mise run test` tetap tidak membutuhkan jaringan ke OSV.
- [x] README/AGENTS menyebut `mise run scan`.

## Tasks
- [x] `mise.toml`: pin `osv-scanner`, task `scan`.
- [x] `osv-scanner.toml`: konfigurasi + format pengecualian (kosong bila tidak ada).
- [ ] Jalankan scan awal, tangani temuan.
- [x] Dokumentasi di `AGENTS.md` root dan `README.md`.
- [ ] (Menyusul) job CI terjadwal + pada tiap PR, bersama CI di spec 000.
