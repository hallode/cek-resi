---
name: dev-flow
description: Alur kerja default untuk SETIAP tugas coding yang bukan sepele di repo cek-resi (fitur, perbaikan bug, refaktor, perubahan spec). Subagent planner membuat rencana -> user menyetujui -> subagent executor mengerjakan -> user ditanya mau review atau tidak -> subagent reviewer meninjau. Pakai juga saat user minta "plan", "rencanakan", "kerjakan", atau /dev-flow. Untuk hotfix ("hotfix", "fix cepat", mode=hotfix) planner dilewati.
argument-hint: "<deskripsi tugas> [mode=normal|hotfix] [review=ask|always|never] [rounds=N] [ponytail=lite|full|ultra]"
---

# Dev flow: plan -> OK -> execute -> review?

Skill ini dijalankan oleh **sesi utama** (orkestrator). Subagent tidak bisa bertanya ke user, jadi setiap gerbang persetujuan ditanyakan oleh sesi utama dengan `AskUserQuestion`.

## Pengaturan
**Model dan effort** tiap peran diatur di `.claude/agents.toml` (default effort `high`) dan diterapkan ke frontmatter agen lewat `mise run agents:sync`. Saat memanggil subagent, **jangan** mengisi parameter `model` atau `effort` di tool Agent. Cukup `subagent_type: "planner" | "executor" | "reviewer" | "explorer"`, maka config itu yang dipakai.

| Opsi | Default | Arti |
|---|---|---|
| `mode` | `normal` | `hotfix`: lewati langkah 1-2 (lihat [Jalur hotfix](#jalur-hotfix)) |
| `review` | `ask` | `ask`: tanya user setelah eksekusi; `always`: langsung review; `never`: lewati |
| `rounds` | `2` | maksimal putaran perbaikan -> tinjau ulang |
| `ponytail` | `full` | level executor ([ponytail](../ponytail/SKILL.md)) |

Opsi bisa disebut di pemanggilan, mis. `/dev-flow review=always <tugas>`.

## Langkah

**Brief adalah seluruh konteks subagent** (ia mulai dari nol). Susun berurutan: (1) direktori kerja, (2) apa yang boleh dilakukan di sana (read-only atau edit di path tertentu), (3) rencana/tugas yang dikutip apa adanya, (4) path spesifik dari Peta konteks di `AGENTS.md`. Jangan menulis "baca repo".

Pertanyaan sempit tentang kode ("di mana X dipanggil?") dijawab oleh subagent **`explorer`**, bukan dengan membaca banyak file di sesi utama. Pertanyaan yang saling lepas boleh dikirim ke beberapa explorer sekaligus. Delegasi adalah alat, bukan ritual: hal yang sudah ada di konteks tidak perlu ditanyakan ulang.

### 1. Plan (subagent `planner`)
Panggil Agent `subagent_type: "planner"` dengan: tugas dari user apa adanya, baris Peta konteks yang relevan, dan path yang sudah diketahui. Jangan menulis rencana sendiri dan jangan mulai mengedit.

### 2. Gerbang: setujui rencana
Hasil subagent tidak terlihat oleh user, jadi **tampilkan rencananya** (verdict, tujuan, di luar lingkup, spec yang diubah, langkah, risiko) secara ringkas tapi lengkap. Verdict `not-feasible` → sampaikan alasannya dan berhenti. Bila planner menulis **Pertanyaan terbuka**, tanyakan itu dulu.

Lalu tanya dengan `AskUserQuestion`:
- **"OK, kerjakan"**: lanjut ke langkah 3 tanpa pertanyaan lain.
- **"Ubah rencana"**: kirim catatan user ke planner (panggil ulang dengan rencana lama + catatan), lalu kembali ke gerbang ini.
- **"Batal"**: berhenti dan jangan mengubah apa pun.

Tidak ada file yang boleh diubah sebelum user memilih "OK, kerjakan".

### 3. Execute (subagent `executor`), otomatis setelah OK
Buat branch dulu sesuai [Branch](#branch). Lalu panggil Agent `subagent_type: "executor"` dengan **rencana yang disetujui apa adanya**, level `ponytail`, dan path yang relevan. Spec + `cases.json` diubah dulu bila perilaku berubah. Langkah di service berbeda yang tidak berbagi file boleh dipanggil paralel (beberapa executor dalam satu pesan); selebihnya berurutan.

Setelah executor selesai, jalankan sendiri `mise run lint` dan `mise run test` lalu baca hasilnya. Laporan agen tidak cukup. Bila merah: panggil executor lagi dengan output kegagalannya (maksimal `rounds` kali), lalu laporkan ke user bila masih merah.

### 4. Gerbang: review?
Ringkas ke user apa yang berubah (file + hasil lint/test berangka). Lalu, bila `review=ask`, tanya dengan `AskUserQuestion`:
- **"Ya, review"**: lanjut ke langkah 5.
- **"Tidak, selesai"**: lanjut ke langkah 6.

### 5. Review (subagent `reviewer`)
Panggil Agent `subagent_type: "reviewer"` dengan **konteks segar**: hanya ruang lingkup diff (`git diff` / hash commit) dan spec terkait, **bukan** ringkasan atau klaim executor, agar tinjauannya independen. Tampilkan laporannya ke user (Must fix / Should fix / Nice to have + verdict).

Bila ada **Must fix**, tanya dengan `AskUserQuestion`:
- **"Perbaiki Must fix"**: executor memperbaiki (beri daftar temuannya), lalu jalankan lint/test dan reviewer meninjau ulang diff perbaikan saja. Maksimal `rounds` putaran.
- **"Biarkan, saya putuskan nanti"**: lanjut ke langkah 6.

Should fix / Nice to have tidak dikerjakan otomatis; sebutkan saja.

### 6. Selesai
- Commit selalu (di branch fitur, bukan `master`).
- Tanya dengan `AskUserQuestion` apakah dibuatkan PR. Sebutkan dulu bila lint/test merah atau masih ada Must fix.
  - **"Ya, buat PR"**: `git push -u origin <branch>`, lalu `gh pr create --base master` (judul + ringkasan perubahan, hasil verifikasi, temuan yang dibiarkan). Pakai `--draft` bila lint/test merah atau ada Must fix tersisa. Tampilkan URL PR-nya.
  - **"Tidak, simpan lokal"**: jangan push; sebutkan nama branch-nya.
- Tidak pernah push langsung ke `master`; merge PR hanya atas permintaan user.
- Laporkan: apa yang berubah, hasil verifikasi, temuan yang dibiarkan, dan yang belum bisa diperiksa (mis. tampilan browser).

## Branch
Setiap pekerjaan yang mengubah file dikerjakan di **branch baru**, dibuat otomatis oleh sesi utama sebelum edit pertama (tanpa ditanya). Prefix sesuai jenis pekerjaan:

| Prefix | Dipakai untuk |
|---|---|
| `feat/<nnn>-<nama>` | fitur baru atau perubahan perilaku (`nnn` = nomor spec) |
| `hotfix/<nama>` | `mode=hotfix` |
| `fix/<nama>` | perbaikan bug lewat alur normal |
| `refactor/<nama>` | refaktor tanpa perubahan perilaku |
| `chore/<nama>` | tooling, config, dependency, agen/skill |
| `docs/<nama>` | dokumen/spec tanpa perubahan perilaku |

`<nama>` kebab-case, singkat (≤ 40 karakter). Langkah:
1. Working tree kotor dengan perubahan yang bukan bagian tugas ini → tanya user (bawa ke branch baru / stash / batal), jangan diputuskan sendiri.
2. `git switch master && git pull --ff-only` (gagal karena offline → lanjut dari `master` lokal dan sebutkan).
3. `git switch -c <prefix>/<nama>`; nama sudah ada → tambah `-2`, `-3`.

Pengecualian: putaran perbaikan dalam alur yang sama tetap di branch itu, dan user boleh meminta melanjutkan di branch tertentu.

## Jalur hotfix
Untuk bug yang jelas: kode menyimpang dari spec yang sudah ada, penyebab dan lingkupnya sudah diketahui. Dipakai bila user menyebut "hotfix"/`mode=hotfix`.
- Lewati langkah 1-2 (tanpa planner dan tanpa gerbang rencana). Tulis ringkas ke user dalam 2-3 baris: bug, penyebab dugaan, file yang akan diubah; lalu langsung kerjakan.
- Branch `hotfix/<nama>` (lihat [Branch](#branch)). Penyebab belum jelas → satu `explorer` dulu, bukan planner.
- Langkah 3-6 tetap berlaku: executor, lint/test dijalankan sendiri, tanya review, commit, tanya PR. Bila belum ada kasus di `cases.json` yang menangkap bug ini, executor menambahkannya.
- Pindah ke alur normal (berhenti dan sampaikan ke user) bila ternyata perlu mengubah perilaku di spec, menyentuh lebih dari satu service, atau perbaikannya tidak kecil.

## Batas
- Aturan repo tetap berlaku: tanpa spec tidak ada fitur; `mise run scan`, komentar/merge PR hanya atas permintaan user.
- Tugas yang benar-benar sepele (typo, satu baris yang jelas) boleh dikerjakan langsung tanpa alur ini; bila ragu, pakai alurnya.
- Operasi berisiko atau tidak bisa dibalik tetap ditanyakan, walaupun rencana sudah disetujui.
