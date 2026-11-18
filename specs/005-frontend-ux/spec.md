# 005 — Frontend UI/UX

| | |
|---|---|
| Status | Implemented sebagian (kode selesai, lolos uji DOM otomatis; belum diverifikasi di browser sungguhan) |
| Pemilik | `web/` (frontend; tidak ada service backend) |
| Service lain yang tersentuh | — (hanya memakai API yang sudah ada via gateway) |
| Bergantung pada | 000 (aturan frontend F1–F7), 001 (tab Cek Resi) |
| Test vectors | tidak ada `cases.json` (tidak ada kontrak HTTP); verifikasi lewat [Kriteria penerimaan](#kriteria-penerimaan) |

## Latar belakang
UI sekarang fungsional tapi polos: 10 tombol kurir yang membungkus ke banyak baris, hasil berupa tabel biasa tanpa hierarki, tidak ada loading/empty state yang jelas, belum dirancang untuk HP, tidak ada dark mode, dan aksesibilitas belum diperhatikan. Spec ini mendefinisikan tampilan dan pengalaman yang dituju, plus **komponen bersama** yang dipakai ulang oleh tab Banyak Resi (003) dan Cek Ongkir (004).

## Scope
- Masuk: desain visual (token warna/tipografi/spasi), layout, komponen, state (kosong/loading/error/hasil), responsif, dark mode, aksesibilitas, microcopy, target performa.
- Tidak masuk: login, notifikasi, logo kurir asli (merek dagang), multi-bahasa, PWA, perubahan API.

## Prinsip UX
- **P1 — Satu aksi utama.** Dari buka halaman sampai melihat hasil: tempel resi → Enter. Maksimal 2 aksi (kurir memakai default/terakhir dipakai).
- **P2 — Jawaban dulu, detail kemudian.** Hasil menjawab "paketku sekarang di mana?" dalam sekali lihat: status besar di atas, riwayat lengkap di bawah.
- **P3 — Mobile-first.** Mayoritas pengguna cek resi dari HP. Desain mulai dari lebar 360px.
- **P4 — Selalu ada umpan balik.** Tidak ada layar kosong tanpa penjelasan: loading, error, dan kondisi awal punya tampilan sendiri.
- **P5 — Bisa dibagikan.** Hasil punya permalink dan tombol salin.
- **P6 — Bisa dipakai semua orang.** WCAG 2.2 AA, navigasi keyboard penuh, hormati `prefers-reduced-motion` dan `prefers-color-scheme`.

## Layout

Mobile (360px):
```
┌──────────────────────┐
│ cekresi    ☰/tab bar │  ← sticky; tab scroll horizontal
├──────────────────────┤
│ Cek Resi Paket       │
│ Tempel nomor resi…   │
│ ┌──────────────────┐ │
│ │ No Resi      [×] │ │  ← input besar, 48px
│ └──────────────────┘ │
│ ‹ Otomatis  JNE  J&T ›│ ← chip kurir, scroll horizontal
│ [      Cek Resi     ]│
│ Riwayat: ▢ ▢ ▢  Hapus│
├──────────────────────┤
│ ┌── kartu hasil ────┐│
│ │ JP1234…  [salin]  ││
│ │ ● Terkirim        ││  ← status hero
│ │ Jakarta → Semarang││
│ │ ──●──●──●──●──    ││  ← stepper
│ │ Perjalanan Paket  ││
│ │ ● 10 Nov 11:22 …  ││  ← timeline vertikal
│ └───────────────────┘│
└──────────────────────┘
```

Desktop (≥960px): kolom konten tengah, lebar maks 720px; kartu hasil memakai dua kolom (ringkasan di kiri, timeline di kanan) mulai ≥ 960px.

## Design tokens
Didefinisikan sebagai CSS custom properties di `web/css/tokens.css`; komponen hanya memakai token, bukan nilai mentah.

- **Warna** (nilai awal; kontras teks ≥ 4.5:1, diverifikasi dev dengan checker kontras):

  | Token | Terang | Gelap | Pakai untuk |
  |---|---|---|---|
  | `--brand` | `#c8221d` | `#ff6b66` | tombol utama, link, fokus |
  | `--bg` | `#f6f7f9` | `#0f1216` | latar halaman |
  | `--surface` | `#ffffff` | `#181c22` | kartu |
  | `--text` | `#1f2328` | `#e8eaed` | teks utama |
  | `--muted` | `#5b6472` | `#a0a8b4` | teks sekunder |
  | `--border` | `#e1e4e8` | `#2c323b` | garis, input |

- **Status** — selalu **ikon + teks + warna** (tidak mengandalkan warna saja):

  | Status | Label | Ikon (SVG inline) | Warna |
  |---|---|---|---|
  | `PICKED_UP` | Dijemput | kotak/paket | biru |
  | `IN_TRANSIT` | Dalam Perjalanan | truk | biru |
  | `OUT_FOR_DELIVERY` | Sedang Diantar | motor/kurir | oranye |
  | `DELIVERED` | Terkirim | centang | hijau |
  | `RETURNED` | Diretur | panah balik | merah |

- **Tipografi**: font sistem (`system-ui`), tanpa webfont. Skala 14 / 16 / 20 / 28px. Nomor resi memakai `ui-monospace` + `font-variant-numeric: tabular-nums`. Input ≥ 16px (mencegah zoom otomatis di iOS).
- **Spasi**: kelipatan 4px. **Radius**: 12px kartu/input, 999px chip. **Bayangan**: satu tingkat halus untuk kartu; di dark mode diganti border.
- **Gerak**: transisi ≤ 200ms; nonaktif bila `prefers-reduced-motion: reduce`.

## Komponen dan perilaku

### Navigasi tab (F1–F4)
Bar tab menempel di atas (sticky). Tab aktif diberi garis bawah + `aria-current="page"`. Di layar sempit bar bisa digeser horizontal tanpa memotong label. Tab yang belum diimplementasi tampil redup dengan badge "Segera" (F5).

### Form pencarian (komponen bersama)
- **Input resi**: satu kolom besar (tinggi ≥ 48px), label terlihat ("No Resi"), placeholder "Tempel nomor resi di sini", tombol hapus (×) saat terisi. Spasi di tepi dipangkas saat dikirim; huruf besar hanya tampilan.
- **Autofocus** hanya di desktop; di HP tidak (agar keyboard tidak langsung menutupi layar).
- **Pilihan kurir**: baris chip (`role="radiogroup"`, navigasi panah kiri/kanan). Di HP digeser horizontal dengan scroll-snap, di desktop membungkus. Kurir terakhir yang dipilih diingat (`localStorage`). Setelah spec 002: chip pertama **"Otomatis"** dan menjadi default.
- **Tombol "Cek Resi"**: lebar penuh di HP; saat memuat berubah jadi spinner + "Mencari…", dinonaktifkan agar tidak dobel kirim.
- **Riwayat**: maks 10, chip bisa diklik; tombol "Hapus riwayat" dan hapus per-item. Disembunyikan bila kosong.
- Komponen ini (field, chip, tombol) dipakai ulang oleh tab Banyak Resi dan Cek Ongkir.

### Kartu hasil
1. **Header**: nomor resi (monospace) + tombol **Salin** (umpan balik "Tersalin ✓" 2 detik) + nama kurir dengan avatar inisial (bukan logo asli).
2. **Status hero**: badge status besar (ikon + label) dan satu baris ringkasan, mis. "Diterima oleh Siti Aminah · 11 Nov 2026, 13:47 WIB (2 jam lalu)".
3. **Rute**: `Asal → Tujuan`, plus layanan (mis. REG).
4. **Stepper progres**: Dijemput → Dalam Perjalanan → Sedang Diantar → Terkirim, langkah yang sudah lewat terisi. Untuk `RETURNED`, ganti dengan banner peringatan merah "Paket diretur ke pengirim".
5. **Perjalanan Paket**: timeline vertikal (`<ol>`), terbaru di atas dan diberi titik berwarna; dikelompokkan per tanggal; tiap item: jam, deskripsi, lokasi. Waktu ditampilkan dalam zona Asia/Jakarta berlabel **WIB**.
6. **Aksi**: "Salin link" (permalink `#/resi?...`) dan "Perbarui" (cek ulang).

### State
| State | Tampilan |
|---|---|
| **Awal** | hero dengan ajakan + "Coba contoh:" 3 chip resi dummy yang bisa diklik (mengisi & langsung mencari) |
| **Loading** | skeleton kartu hasil (bukan teks "Memuat…"), `aria-busy="true"` |
| **Error 404** | ilustrasi/ikon + "Resi tidak ditemukan. Periksa nomor resi atau coba kurir lain." + saran memilih kurir |
| **Error 400** | pesan dari API, input diberi tanda error dan fokus kembali ke input |
| **Error 502/jaringan** | "Layanan sedang sibuk." + tombol **Coba lagi** |
| **Hasil** | kartu hasil; fokus berpindah ke judul hasil |

### Microcopy (Bahasa Indonesia)
Singkat, ramah, tanpa istilah teknis. Pesan error dari API (`error`) ditampilkan apa adanya bila relevan, dilengkapi saran tindakan di sisi UI.

## Responsif
- Titik patah: **360** (minimum didukung), **640**, **960**.
- Tidak ada scroll horizontal di 360px (kecuali baris chip yang memang bisa digeser).
- Target sentuh ≥ 44×44px; jarak antar target ≥ 8px.

## Aksesibilitas (WCAG 2.2 AA)
- Kontras teks ≥ 4.5:1 (terang dan gelap), komponen UI ≥ 3:1.
- Semua fungsi bisa dipakai dengan keyboard; indikator fokus selalu terlihat (outline 2px `--brand`, offset 2px).
- Ada *skip link* "Lewati ke konten"; `<html lang="id">`.
- Loading, hasil, dan error diumumkan lewat region `aria-live="polite"`; setelah hasil muncul, fokus ke judul hasil.
- Status tidak disampaikan hanya lewat warna (ikon + teks).
- Timeline memakai `<ol>`; waktu memakai `<time datetime="…">`.
- `prefers-reduced-motion` dan `prefers-color-scheme` dihormati.

## Performa
- Tanpa framework, tanpa webfont, tanpa request eksternal. CSS total ≲ 20KB tanpa kompresi.
- Skrip berupa ES module (deferred); halaman terlihat dan form bisa diisi sebelum JS selesai dimuat.
- Lighthouse (mobile, throttling default): Performance, Accessibility, Best Practices ≥ 95.

## Struktur berkas
```
web/
├── index.html           kerangka halaman, tab, skip link
├── css/tokens.css       custom properties (terang + gelap)
├── css/base.css         reset, tipografi, layout
├── css/components.css   tab, field, chip, tombol, kartu, badge, timeline, skeleton
└── js/
    ├── router.js        (000)
    ├── resi.js          tab Cek Resi (001, 002)
    └── ui.js            helper bersama: format waktu WIB, salin ke clipboard, live region, skeleton
```

## Kriteria penerimaan
> **Status verifikasi.** Perilaku sudah diuji otomatis di DOM (jsdom) terhadap server asli: tab & hash route, state awal/loading/404/400/hasil, varian `RETURNED`, permalink, navigasi keyboard, riwayat, dan teks API tidak diparse sebagai HTML. Belum diverifikasi di browser sungguhan, jadi butir di bawah yang menyangkut tampilan visual, dark mode, kontras terukur, pembaca layar, dan Lighthouse **belum dicentang**. State 502/jaringan belum diuji.

- [ ] Tampilan benar di 360px, 768px, dan 1280px, mode terang dan gelap (tangkapan layar terlampir di PR).
- [ ] Alur utama selesai dalam ≤ 2 aksi: tempel resi → Enter.
- [ ] Keenam state (awal, loading, 404, 400, 502, hasil) punya tampilan sesuai tabel.
- [ ] Status selalu berupa ikon + teks; `RETURNED` memakai banner peringatan.
- [ ] Hanya dengan keyboard: bisa memilih kurir (panah), mengirim, menyalin resi/link, membuka riwayat; fokus selalu terlihat.
- [ ] Pembaca layar membacakan "Mencari…", hasil, dan error (cek manual dengan VoiceOver).
- [ ] Kontras lulus checker untuk semua pasangan token di mode terang dan gelap.
- [ ] Tidak ada scroll horizontal di 360px selain baris chip; target sentuh ≥ 44px.
- [ ] Lighthouse mobile: Performance, Accessibility, Best Practices ≥ 95.
- [ ] Tab Banyak Resi dan Cek Ongkir memakai komponen bersama (field, chip, tombol, kartu, skeleton) tanpa gaya baru.

## Tasks
- [x] `css/tokens.css`, `base.css`, `components.css`: token, dark mode, komponen.
- [x] `index.html`: tab bar sticky, skip link, `aria-live` region, kerangka kartu.
- [x] `js/ui.js`: format waktu WIB + relatif, salin clipboard, skeleton, live region.
- [x] `js/resi.js`: form, chip kurir (panah keyboard, ingat pilihan), riwayat (hapus), state awal/loading/error, kartu hasil (status hero, rute, stepper, timeline per tanggal, Salin/Perbarui).
- [x] Ikon status sebagai SVG inline (lima ikon + ikon salin, hapus, error).
- [x] Uji manual sesuai kriteria penerimaan; lampirkan tangkapan layar dan skor Lighthouse di PR.
