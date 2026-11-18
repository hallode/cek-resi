---
name: review-code
description: Review kode untuk repo cek-resi - diff yang belum di-commit, commit terakhir, PR (nomor atau URL), atau path tertentu. Memeriksa kesesuaian spec, bug, keamanan, kontrak lintas-service, test, dan kelebihan kode; melaporkan temuan terverifikasi berperingkat. Read-only. Pakai saat user minta "review", "cek PR", atau sebelum merge.
argument-hint: "[diff | HEAD | PR <nomor|url> | path]"
---

# Review kode

Review ini **read-only**: tidak mengedit file, tidak commit/push, tidak memposting komentar PR, tidak merge. Posting komentar atau merge hanya bila user memintanya secara eksplisit, dan itu dilakukan terpisah setelah laporan (untuk PR GitHub, alurnya ada di skill `review-pr`). Untuk PR, `file:baris` merujuk nomor baris di versi head PR.

Struktur review diadaptasi dari `/ponytail-review` ([ponytail](https://github.com/dietrichgebert/ponytail), MIT), disesuaikan dengan repo ini.

## 1. Tentukan cakupan
Sesuai argumen: `diff` (default: perubahan belum di-commit; bila kosong, commit terakhir), `HEAD`, `PR <n>` (`gh pr diff <n>` / `gh pr view <n>`), atau path. Untuk PR, **buktikan basisnya**: `git merge-base master <head>` dan `git merge-tree --write-tree --name-only master <head>`; jangan menyimpulkan "basis usang" atau "konflik" dari satu petunjuk. Basis dan head bisa berubah saat review berjalan; cek ulang sebelum melapor.

## 2. Kumpulkan konteks
Mulai dari diff, lalu baca **hanya** yang dibutuhkan untuk menilainya: spec yang relevan (cari kasus di `cases.json` dengan grep, bukan membaca seluruh file), pemanggil dan fungsi yang dipanggil (temukan dengan grep), dan test yang ikut berubah. Jangan membaca seluruh repo atau service yang tidak tersentuh.

## 3. Periksa, berurutan
1. **Kesesuaian spec.** Perilaku vs `spec.md` dan `cases.json`. Spec ikut diubah kalau perilaku berubah? Status ("Implemented", centang tugas) didukung bukti? Kode yang menyimpang dari spec = bug.
2. **Bug dan kasus tepi.** Validasi di batas kepercayaan, normalisasi (K3), bentuk error (K1/K2), array `null` (K5), angka/Unicode ekstrem, race, timeout.
3. **Keamanan dan data.** Nomor resi/PII di log, `innerHTML` dengan data API, path traversal, input yang diteruskan ke upstream, dependency baru (apakah perlu `mise run scan`), panggilan ke layanan eksternal (dilarang, A6).
4. **Kontrak lintas-service.** Tabel `ROUTES` di gateway, port/env (`*_URL`), aturan A1-A6 di spec 000, tidak ada import kode lintas service atau DB bersama, kontrak JSON tidak bergeser diam-diam.
5. **Test.** Logika baru punya test (termasuk jalur gagal)? Spec didaftarkan di `SPEC_FILES`? Test benar-benar membuktikan klaimnya, bukan menyalin implementasi?
6. **Skala dan performa.** Pekerjaan berulang, memori tumbuh, O(n²), panggilan upstream berantai tanpa batas atau deadline.
7. **Kelebihan kode** (ponytail). Kode mati, duplikasi, abstraksi tanpa pemakai, dependency yang tidak perlu, helper yang sebenarnya sudah ada di repo.
8. **Frontend** (bila `web/`). Aksesibilitas dasar, state loading/error/kosong, sesuai spec 005.

## 4. Verifikasi sebelum melapor
Setiap temuan dicocokkan dengan kode atau hasil perintah (`mise run lint:<svc>`, `mise run test:<svc>`, skrip sekali pakai di `$TMPDIR`, reproduksi kecil). Beri label **CONFIRMED** (kamu melihat/mereproduksinya) atau **PLAUSIBLE** (masuk akal tapi belum terbukti; tulis alasannya). Temuan yang ternyata salah **dibuang**. Jangan melaporkan apa yang tidak kamu lihat; yang tidak bisa diperiksa masuk "Belum diperiksa".

## 5. Format laporan
```
Ringkasan: <apa yang dilakukan perubahan ini, 1-2 kalimat>
Dicek: <lint/test yang dijalankan + hasil berangka>

Must fix
1. <file:baris> [CONFIRMED] <masalah> - <skenario gagal konkret> - <saran perbaikan>
Should fix
2. ...
Nice to have
3. ...

Verdict: <siap merge | perbaiki dulu | tidak bisa dinilai> - <alasan satu kalimat>
Belum diperiksa: <hal yang tidak bisa diverifikasi di sini>
```
- **Must fix**: bug, kebocoran data, kontrak/spec dilanggar, test yang menyesatkan. **Should fix**: risiko nyata tapi tidak merusak sekarang. **Nice to have**: kerapian, kelebihan kode.
- Urut dari yang paling berat. Sebut skenario gagal yang konkret (input -> hasil yang salah), bukan "bisa saja bermasalah".
- Bila tidak ada temuan, katakan itu dengan jelas dan sebut apa saja yang sudah diperiksa.
