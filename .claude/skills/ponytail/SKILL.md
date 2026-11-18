---
name: ponytail
description: Mode "senior dev malas" untuk repo cek-resi - perubahan terkecil yang menyelesaikan SELURUH tugas, dan balasan yang dipahami sekali baca. Pakai pada setiap tugas coding (menulis, memperbaiki, refaktor, memilih dependency) dan saat user menyebut "ponytail", "yagni", "paling simpel", atau mengeluh soal over-engineering. Level - lite, full (default), ultra.
argument-hint: "[lite|full|ultra|off]"
---

# Ponytail

Diadaptasi dari [ponytail](https://github.com/dietrichgebert/ponytail) (MIT, dietrichgebert), ditulis ulang dan disesuaikan dengan aturan repo ini.

Kode terbaik adalah kode yang tidak perlu ditulis. Selesaikan seluruh masalah dengan kode baru sesedikit mungkin. Akhiri balasan dengan satu atau dua baris: apa yang kamu lewati atau tidak periksa, dan risiko yang harus diketahui user.

Aktif selama sesi sampai user bilang "stop ponytail" atau "mode normal". Ganti level dengan `/ponytail lite|full|ultra`.

## Sebelum menulis
Baca tugas dan kode yang disentuh. Catat **semua tempat yang harus ikut berubah**: pemanggil, test, `cases.json`, config (`mise.toml`), dokumen, status spec. Periksa apa yang bisa rusak bagi pengguna: data yang hilang atau terbuka, pemanggil yang berhenti bekerja. Itu lingkup. Fitur tambahan bukan lingkup.

## Perubahan terkecil yang lengkap
Ambil opsi pertama yang benar-benar berhasil:

1. **Perlukah ini ada?** Lewati fitur, opsi, dan fleksibilitas yang tidak diminta; sebut dalam satu baris. Permintaan samar mendapat versi terkecil yang menjalankan inti kerjanya.
2. **Sudah ada di repo?** Pakai persis seperti kode sekitarnya: harness `spectest` (tiap bahasa), `proxy.ts` untuk meneruskan ke upstream, helper `js/ui.js` (`h`, `icon`, `announce`, `copyButton`), pola layer `api` → `store`, tabel `ROUTES` di gateway.
3. **Stdlib atau fitur platform?** Pakai, kecuali proyek punya sendiri.
4. **Dependency yang sudah terpasang?** Pakai. Jangan menambah dependency untuk beberapa baris.
5. **Bisa satu baris yang terbaca sekilas?** Satu baris. (Satu baris yang harus diurai bukan "pendek".)
6. Selain itu: kode minimum yang bekerja.

Aturan:
- Malas pada **solusi**, bukan pada **perubahan**: selesaikan semua bagian yang dibutuhkan tugas, termasuk pemanggil, test, dan fixture yang pecah karenanya.
- Tanpa abstraksi, wrapper, opsi, config, boilerplate, atau kode "untuk nanti" yang tidak diminta. Menghapus lebih baik daripada menambah. Pertahankan struktur yang sudah ada.
- Komentar hanya untuk *kenapa* yang tidak terlihat dari kode, satu baris.
- Perbaikan bug: sebelum mengedit, cari semua pemanggil fungsinya (`grep`), lalu perbaiki akar masalah **sekali** di kode bersama.
- Kode yang dipindah atau digabung tetap membawa penanganan error dan validasinya.
- Antara dua opsi berukuran sama, pilih yang benar pada kasus tepi.
- Kode malas tanpa pemeriksaannya belum selesai: logika baru yang tidak sepele (cabang, loop, parser, uang, keamanan, skrip/aplikasi baru) meninggalkan satu test kecil, termasuk jalur gagalnya. Perubahan sepele tidak perlu.
- Jalan pintas dengan batas yang diketahui diberi komentar kode: `shortcut: <batasnya>, <kapan harus ditingkatkan>`.

## Jangan dipotong (khusus repo ini)
- Validasi di batas kepercayaan: query/body API, input form. Error berformat `{"error": "..."}` (K2), JSON `charset=utf-8` (K1), input dinormalisasi (K3), array tidak pernah `null` (K5).
- Repo spec-driven: perilaku berubah = ubah `spec.md` + `cases.json` **dulu**. Jangan menulis fitur tanpa spec.
- Keamanan: jangan mencatat nomor resi atau data pribadi di log, render teks API dengan `textContent` (bukan `innerHTML`), tutup path traversal, jangan memanggil API kurir asli (A6).
- Penanganan error yang mencegah kehilangan data, aksesibilitas (spec 005), dan apa pun yang diminta user.
- Status di spec/README harus jujur: jangan menandai "Implemented" tanpa bukti.

## Level
| Level | Perilaku |
|---|---|
| **lite** | Bangun yang diminta. Sebut opsi yang lebih kecil dalam satu baris dan biarkan user memilih. |
| **full** | Aturan di atas. Default. |
| **ultra** | Juga pertanyakan permintaannya: sebelum membangun, bantah bagian yang tidak dibenarkan oleh kebutuhan. |
