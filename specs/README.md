# Specs

Repo ini **spec-driven**: perilaku sistem didefinisikan dulu di `specs/`, baru diimplementasikan. Kode yang perilakunya beda dengan spec dianggap bug — perbaiki kodenya, atau ubah spec-nya dulu (lewat review) kalau spec-nya yang salah.

## Daftar spec

| ID | Judul | Service pemilik | Bahasa | Status | Bergantung pada |
|---|---|---|---|---|---|
| [000](000-architecture/spec.md) | Arsitektur monorepo polyglot | semua | — | Draft | — |
| [001](001-tracking-provider/spec.md) | Tracking + provider adapter | `tracking-go` | Go | Draft (API sudah ada) | 000 |
| [002](002-courier-detection/spec.md) | Deteksi kurir otomatis | `detect-rust` | Rust | Draft | 000, 001 |
| [003](003-bulk-tracking/spec.md) | Cek banyak resi + permalink | `gateway-ts` | TypeScript | Draft | 001, 002 |
| [004](004-ongkir/spec.md) | Cek ongkir | `ongkir-py` | Python | Draft | 000 |

Urutan kerja yang disarankan: 000 → 001 → 002 → 003. Spec 004 independen dan bisa paralel setelah 000.

## Alur kerja

1. **Draft** — tulis/ubah `spec.md` (salin dari [`_template.md`](_template.md)) dan `cases.json`.
2. **Approved** — sudah di-review; kontrak & kasus dianggap final untuk iterasi ini.
3. Implementasi: test di service **wajib membaca `cases.json`** dari spec terkait, bukan menyalin kasusnya ke kode test.
4. **Implemented** — semua kasus lulus di CI; update kolom Status di tabel atas dan di header spec.

Mengubah kontrak setelah Implemented = buat perubahan di spec dulu (status kembali ke Draft untuk bagian itu), baru kode.

## Format `cases.json`

Satu file per spec, dipakai oleh test di bahasa apa pun.

```json
{
  "spec": "002-courier-detection",
  "level": "service",
  "target": "detect-rust",
  "cases": [
    {
      "name": "sicepat 12 digit",
      "request": { "method": "GET", "path": "/api/detect?awb=004000123456" },
      "expect": { "status": 200, "body": { "candidates": [{ "code": "sicepat" }, { "code": "tiki" }] } }
    }
  ]
}
```

- `level`
  - `service` — kasus dijalankan langsung ke service `target` (in-process atau via `BASE_URL`), tanpa service lain.
  - `e2e` — kasus dijalankan ke gateway (`BASE_URL`, default `http://localhost:8080`) dengan semua service yang dibutuhkan hidup.
- `target` di level case (opsional) meng-override `target` file — dipakai bila satu file berisi kasus untuk beberapa service (mis. health check di 000).
- `request.body` (opsional) dikirim sebagai JSON dengan `Content-Type: application/json`.
- `expect.status` dibandingkan persis.
- `expect.body` memakai **partial deep match**:
  - **Object**: setiap key yang disebut harus ada dan cocok; key lain di respon diabaikan.
  - **Array**: panjang dan urutan harus sama; tiap elemen dicocokkan secara partial.
  - **`{"$length": N}`**: pengganti array — hanya cek panjang array = N.
  - Nilai skalar dibandingkan persis (tipe JSON juga harus sama).

Setiap bahasa cukup punya satu helper `matchPartial(expected, actual)` kecil yang mengikuti aturan di atas. Lokasi helper per service ada di [000](000-architecture/spec.md#testing).
