---
name: dev-flow
description: Alur kerja tiga peran untuk cek-resi - planner (rencana) -> executor (kerjakan) -> reviewer (tinjau independen), berulang sampai tidak ada Must fix, lalu verifikasi dan push. Pakai untuk tugas yang menyentuh lebih dari satu file/service atau yang berisiko; tugas sepele cukup dikerjakan langsung. Pemanggilan - /dev-flow <tugas>.
argument-hint: "<deskripsi tugas>"
---

# Dev flow: planner -> executor -> reviewer

## Pengaturan
Ubah di sini atau di frontmatter berkas agen (`model`, `tools`, `effort`). Di sinilah tempat mengganti pengaturan peran.

| Peran | Berkas | Model | Tool | Tugas |
|---|---|---|---|---|
| **planner** | `.claude/agents/planner.md` | opus | read-only | rencana berurutan + cara pembuktian |
| **executor** | `.claude/agents/executor.md` | sonnet | baca + edit + Bash | kerjakan, jalankan lint/test |
| **reviewer** | `.claude/agents/reviewer.md` | opus | read-only | tinjau independen, temuan terverifikasi |

| Opsi | Default | Arti |
|---|---|---|
| `ponytail` | `full` | level executor: `lite`, `full`, `ultra` ([ponytail](../ponytail/SKILL.md)) |
| `rounds` | `2` | maksimal putaran perbaikan -> tinjau ulang |
| `planner` | `auto` | `auto`: lewati untuk tugas sepele; `always`; `never` |
| `push` | `on-green` | push ke `master` setelah hijau tanpa Must fix; `never` untuk menahan |

Opsi bisa disebut di pemanggilan, mis. `/dev-flow ponytail=ultra rounds=1 <tugas>`.

## Langkah
1. **Rencana.** Tugas sepele (satu file, jelas) -> lewati, tulis rencana satu baris. Selain itu panggil agen `planner` dengan tugas dan konteks yang dibutuhkan. Bila ada **pertanyaan terbuka** yang milik user, tanyakan dulu; jangan menebak.
2. **Persetujuan lingkup** (hanya bila rencana besar, menyentuh banyak service, atau mengubah kontrak): tunjukkan rencananya ke user sebelum eksekusi.
3. **Spec dulu.** Perilaku berubah -> executor mengubah `spec.md` + `cases.json` lebih dulu.
4. **Eksekusi.** Panggil `executor` per langkah rencana. Langkah di service berbeda yang tidak berbagi file boleh paralel; selebihnya berurutan. Executor menjalankan `lint`/`test` dan melapor dengan angka.
5. **Tinjau.** Panggil `reviewer` dengan **konteks segar**: berikan diff (`git diff` / hash commit) dan spec terkait, **jangan** kesimpulan atau ringkasan executor, agar tinjauannya independen.
6. **Putaran perbaikan.** Ada Must fix -> executor memperbaiki, reviewer meninjau ulang diff perbaikannya. Maksimal `rounds`. Sisa Must fix setelah itu dilaporkan ke user, bukan di-push.
7. **Verifikasi akhir.** Jalankan `mise run lint` dan `mise run test` sendiri dan baca hasilnya. Jangan percaya laporan agen tanpa itu.
8. **Selesai.** Tanpa Must fix dan hijau -> commit dan (bila `push=on-green`) push ke `master`; setelahnya cek `git ls-remote --heads origin master` sama dengan HEAD lokal. Laporkan: apa yang berubah, hasil verifikasi, temuan Should fix/Nice to have yang dibiarkan, dan yang belum bisa diperiksa.

## Batas
- Aturan tidak berubah karena alurnya otomatis: tanpa spec tidak ada fitur, `mise run scan` dan aksi keluar (komentar/merge PR) hanya atas permintaan user.
- Jangan memperluas tugas karena izin push ada.
- Operasi berisiko atau tidak bisa dibalik tetap ditanyakan.
