---
name: push-pr
description: Push perubahan dan buka pull request di repo cek-resi dengan aman. Memastikan fitur ada di branch baru (bukan master), nama branch, commit, dan nama di kode (variabel, fungsi, field JSON, env, CSS) sesuai konvensi, lint/test/e2e hijau, dan perubahan tidak merusak alur yang sudah ada (atau user diberi tahu breaking change-nya). Pakai saat user minta "push", "buat PR", "kirim PR", atau /push-pr. Juga dijalankan dev-flow setelah user memilih "Ya, buat PR".
argument-hint: "[base=master] [draft] [no-pr]"
---

# Push + PR

Dijalankan oleh **sesi utama**, hanya atas permintaan user: `/push-pr`, "push"/"buat PR", atau jawaban "Ya, buat PR" di langkah 6 `dev-flow`. Itu izin untuk push **branch fitur** dan membuka PR. Tidak termasuk: push ke `master`, merge PR, komentar PR, atau `mise run scan`.

| Opsi | Default | Arti |
|---|---|---|
| `base` | branch dari `origin/HEAD` (`master`) | branch tujuan PR |
| `draft` | mati | buka PR sebagai draft |
| `no-pr` | mati | hanya push, tanpa membuka PR |

## Konvensi nama
Semua konvensi (branch, commit, judul PR, nama di kode, kontrak, web) ada di [naming.md](naming.md). Branch dicek di langkah 1, commit di langkah 2, nama di kode di langkah 2b.

## Langkah

### 0. Baca keadaan
```sh
git fetch origin
git status -sb
git log --oneline origin/<base>..HEAD
```
`<base>` (nama branch tanpa `origin/`, mis. `master`) bila tidak disebut: `git symbolic-ref --short refs/remotes/origin/HEAD | sed 's#^origin/##'`.

### 1. Gerbang branch: fitur harus di branch baru
- **Sedang di `<base>`** (ada perubahan belum di-commit atau commit lokal yang belum di-push): pilih nama branch sesuai [naming.md](naming.md#branch) dari isi perubahan/spec, lalu `git switch -c <nama>`. Bila ada **commit lokal di `<base>`**, branch baru dibuat di HEAD, lalu `<base>` lokal dikembalikan ke `origin/<base>`. Langkah itu mengubah `<base>` lokal, jadi **tanya dulu** dengan `AskUserQuestion`.
- **Branch lain yang namanya tidak cocok dengan regex di [naming.md](naming.md#branch):** usulkan nama baru (`git branch -m <baru>`). Bila branch lama sudah ada di remote, sebutkan bahwa branch lama di remote tetap ada dan PR lama (bila ada) tidak ikut pindah; tanya dulu.
- **Satu fitur per branch:** bila diff menyentuh beberapa spec yang tidak berhubungan, peringatkan user dan sarankan dipecah. Jangan memecah sendiri tanpa persetujuan.

### 2. Commit
- Perubahan yang belum di-commit: stage hanya file yang relevan (jangan pernah `*.db`, `.env`, kredensial, `node_modules/`, `target/`, `.venv/`). Tulis pesan sesuai [naming.md](naming.md#commit-dan-pr).
- Periksa semua subject di `origin/<base>..HEAD`. Yang melanggar: usulkan perbaikan. Mengubah commit (reword/squash): belum di-push → boleh; sudah di-push → lewat [gerbang tulis ulang](#gerbang-tulis-ulang-riwayat-yang-sudah-di-push) dulu.

### Gerbang tulis ulang riwayat yang sudah di-push
Berlaku untuk **setiap** penulisan ulang commit yang sudah ada di remote (`git ls-remote --heads origin <branch>` tidak kosong): rebase (2a), reword, squash. Berurutan, **sebelum** mengubah apa pun:
0. Lease sudah dicatat di run ini (gerbang sudah lolos, mis. reword lalu rebase): cukup `git fetch origin` lalu `git rev-parse origin/<branch>` == lease → lanjut tanpa bertanya dan tanpa mencatat ulang; berbeda → berhenti dan laporkan. Cek ancestor di bawah tidak dipakai lagi karena commit lama sudah ditulis ulang.
1. `git fetch origin`, lalu `git merge-base --is-ancestor origin/<branch> HEAD`. Gagal → ada commit di remote yang belum ada di lokal (mis. dari kolaborator): **berhenti** dan laporkan (`git log HEAD..origin/<branch>`); jangan tulis ulang dan jangan force push.
2. Tanya dengan `AskUserQuestion`: penulisan ulang perlu force push dan membuat komentar inline di PR jadi outdated.
3. Disetujui → catat `lease=$(git rev-parse origin/<branch>)`, **baru** tulis ulang. Lease ini dipakai di langkah 6.

### 2a. Rebase ke base terbaru
Setelah langkah 2, berurutan:
1. `git merge-base --is-ancestor origin/<base> HEAD` lolos → sudah di atas base terbaru; lewati langkah ini.
2. Branch belum ada di remote → `git rebase --autostash origin/<base>` (file yang sengaja tidak di-stage ikut disimpan sementara).
3. Branch sudah ada di remote → [gerbang tulis ulang](#gerbang-tulis-ulang-riwayat-yang-sudah-di-push) dulu. Disetujui → `git rebase --autostash origin/<base>`. Ditolak → lewati rebase bila `git merge-tree --write-tree origin/<base> HEAD` tanpa konflik; ada konflik → berhenti dan laporkan file konfliknya.
4. Konflik yang jelas (kedua sisi menambah hal berbeda, mis. upstream baru di `ROUTES`) diselesaikan dengan menyimpan keduanya. Konflik yang mengubah perilaku ditanyakan ke user. Setelah konflik, langkah 4 wajib dijalankan ulang.

### 2b. Cek konvensi nama di kode
Acuan: [naming.md](naming.md). Rust dan Python sudah ditegakkan lint (langkah 4). Sisanya dicek dari baris yang **ditambah** saja:
```sh
git diff -U0 origin/<base>...HEAD -- services web specs mise.toml | grep -E '^(\+\+\+|\+[^+])'
```
Periksa identifier baru (fungsi, variabel, tipe, konstanta, file), field JSON / query param, env var, task mise, kelas CSS / `id` / `data-*`, kunci `localStorage`, folder spec, dan `name` kasus. Laporkan pelanggaran sebagai `file:baris · nama · seharusnya`.
- Nama internal (tidak dilihat service/browser lain): perbaiki sebelum push (commit `Rename ... to follow naming conventions` atau ikut commit fitur bila belum di-push).
- Nama yang sudah jadi kontrak di `<base>` (field JSON, path, env, kunci `localStorage`): **jangan** diganti diam-diam; mengganti = breaking change. Tanya user dan bawa ke langkah 5.
- Nama lama yang sudah ada di `<base>` dan tidak disentuh diff: abaikan.

### 3. Cek spec-driven (peringatan, bukan pemblokir)
Dari `git diff --name-only origin/<base>...HEAD`:
- Ada perubahan di `services/` atau `web/` tapi tidak ada di `specs/` → tanya: apakah perilaku berubah tanpa spec? (aturan repo: tanpa spec tidak ada fitur).
- Spec diubah → status di `specs/README.md` dan header spec ikut diperbarui?
- Test service mendaftarkan `cases.json` baru di `SPEC_FILES`?

### 4. Test
```sh
.claude/skills/push-pr/run-checks.sh origin/<base>
```
Script menjalankan `mise run lint`, `mise run test`, menyalakan semua service (`mise run dev`, menunggu `/health`), lalu `mise run e2e` dan cek kompatibilitas (langkah 5), dan mematikan service lagi. Baca ringkasannya sendiri; jangan melaporkan hasil yang tidak terlihat.
- **Exit 1 (merah):** berhenti, jangan push. Tampilkan bagian yang gagal dan tawarkan perbaikan. Pengecualian: opsi `draft` aktif (mis. dari dev-flow, user memilih "Ya, buat PR" saat lint/test merah) dan yang gagal **hanya** lint/test/e2e yang sudah disebut ke user → langkah 5 tetap dijalankan, lalu push dan PR `--draft`, kegagalannya ditulis di bagian *Testing* PR. `GAGAL start service`, `compat: gagal jalan`, dan `compat: service tidak terjangkau` tidak termasuk pengecualian ini. Bila kegagalan **hanya** `compat: breaking change`, lanjut ke langkah 5 (itu breaking change, bukan otomatis bug). Opsi `draft` + lint/test/e2e merah yang sudah disebut + `compat: breaking change` → langkah 5 dulu (user memutuskan breaking change-nya), lalu PR `--draft`. `compat: service tidak terjangkau` bukan breaking change: cek log `mise run dev`, perbaiki, ulangi. `compat: gagal jalan` = galat alat (mis. base ref salah atau belum di-fetch), bukan breaking change: perbaiki argumennya, ulangi.
- **Exit 2 (port 8080–8083 sibuk):** script tidak mematikan proses user. Minta user menghentikannya, lalu ulangi. Jangan push tanpa e2e kecuali user mengizinkan secara eksplisit; catat di PR bila dilewati.

### 5. Breaking change
Kumpulkan dari tiga sumber:
1. **Replay kontrak lama** (output `services/gateway-ts/e2e/compat.ts` di langkah 4): setiap kasus dari `specs/*/cases*.json` versi `<base>` dijalankan ke service dari branch ini. Kasus yang gagal = perilaku lama berubah. Kasus yang dihapus/diganti nama juga dicatat.
2. **Diff kontrak:** `git diff origin/<base>...HEAD -- 'specs/*/spec.md' 'specs/*/cases*.json'`. Cari bagian "Kontrak API" / tabel error yang berubah, field dihapus/diganti nama, status code berubah.
3. **Diff permukaan:** baris yang **dihapus** (`-`) di:
   - route: `ROUTES` di `services/gateway-ts/src/app.ts`, `HandleFunc(` (Go), `.route(` (Rust), `@app.get(`/`@app.post(` (Python);
   - env & port: `mise.toml` (`[env]`, `PORT`), `process.env.`, `os.Getenv(`, `env::var(`, `os.environ`;
   - task di `mise.toml` dan perintah di `AGENTS.md`;
   - skema DB (`schema.sql`) dan data seed yang dipakai contoh di `README.md`;
   - UI: `id`/`data-*` di `web/index.html` yang dipakai `web/js/`, kunci `localStorage`, format permalink `#/...`.

Tampilkan tabel: **apa yang berubah · siapa yang terdampak (browser / service lain / developer) · bukti (kasus atau baris diff)**. Bila tidak ada, katakan "Tidak ada breaking change terdeteksi" plus apa yang diperiksa.

Bila ada breaking change, tanya dengan `AskUserQuestion`:
- **"Lanjut, tandai di PR"**: lanjut; bagian *Breaking changes* di PR wajib diisi.
- **"Perbaiki dulu"**: berhenti dan tawarkan perbaikan (biasanya: pertahankan perilaku lama, atau ubah spec + `cases.json` lewat review dulu).
- **"Batal"**: berhenti tanpa push.

### 6. Push
- `git push -u origin <branch>`. **Jangan pernah** push ke `<base>`. Ditolak (non-fast-forward) → berhenti dan laporkan; jangan force.
- Setelah riwayat yang sudah di-push ditulis ulang lewat [gerbang tulis ulang](#gerbang-tulis-ulang-riwayat-yang-sudah-di-push): `git push --force-with-lease=<branch>:<lease> origin <branch>` (`<lease>` dari gerbang itu). Pengamannya cek ancestor + lease yang dicatat sebelum tulis ulang; `--force-if-includes` tidak dipakai karena tidak berpengaruh bila lease diberi nilai. Ditolak → berhenti dan laporkan.
- `Permission ... denied` (403): akun tidak punya akses tulis. Jelaskan dua jalan (minta akses collaborator, atau `gh repo fork --remote --remote-name fork` lalu push ke `fork`), lalu berhenti.
- Verifikasi: `git ls-remote --heads origin <branch>` sama dengan `git rev-parse HEAD`.

### 7. Pull request (lewati bila `no-pr`)
Cek `gh auth status`. Bila PR **terbuka** untuk branch ini sudah ada (`gh pr view --json number,url,body,isDraft,state` dengan `state=OPEN`; PR merged/closed tidak dihitung → buat PR baru), tampilkan URL-nya. Perbarui bagian yang dihasilkan run ini (`gh pr edit <n> --body-file <tmp>.md`; bagian yang belum ada ditambahkan sebelum footer): *Breaking changes* dan *Testing* selalu (hasil langkah 4-5 untuk head baru); *Review* + penanda bila dipanggil dari `dev-flow` dengan hasil review, dan tanpa hasil review → hapus seluruh bagian *Review* beserta penandanya (sesuai "Tanpa hasil review" di bawah). Opsi `draft` aktif dan `isDraft=false` → `gh pr ready <n> --undo`. Sebaliknya: PR masih draft dan opsi `draft` tidak aktif → sebut di laporan dan tawarkan dengan `AskUserQuestion` ("Jadikan ready" → `gh pr ready <n>` / "Biarkan draft"); tidak pernah otomatis. Ringkasan dan *Changes* tulisan user dibiarkan; mengubah judul atau bagian lain hanya bila user minta.

Buat PR:
```sh
gh pr create --base <base> --head <branch> --title "<subject>" --body-file <tmp>.md [--draft]
```
Isi `<tmp>.md` (bahasa Inggris, path relatif agar link jalan di GitHub):

```markdown
<1–2 kalimat: apa dan kenapa, dengan link ke spec>

## Changes
- **<service>**: <perubahan>
- ...

## Breaking changes
<"None detected (checked: spec cases from <base> replayed, contract diff, removed routes/env/tasks)." atau tabel dari langkah 5>

## Testing
- `mise run lint`, `mise run test`: <hasil berangka>
- `mise run e2e`: <n> pass
- Compatibility with `<base>` spec cases: <n> pass, <n> fail
- Not checked: <mis. UI belum dicoba di browser sungguhan>

## Review
<hanya bila ada hasil review dari dev-flow; lihat "Penanda review sebelum PR">

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

#### Penanda review sebelum PR
Dipanggil dari `dev-flow` dengan hasil review: isi bagian *Review* dengan verdict dan **semua** temuan yang dibiarkan (Must fix, Should fix, Nice to have), lalu satu baris penanda:
```
<!-- pre-pr-review: head=<sha> fp=<sidik isi> verdict=<siap-merge|perbaiki-dulu> must=<n> -->
```
- `fp` (sidik isi): hitung ulang sekarang, setelah langkah 2a: `git diff-tree -z -r --no-renames "$(git merge-base origin/<base> HEAD)" HEAD | git hash-object --stdin`. Harus 40 hex, **bukan** `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` (hash isi kosong: diff kosong atau perintah gagal), dan **sama** dengan sidik isi dari dev-flow. Berbeda (isi berubah setelah review, mis. resolusi konflik rebase) atau tidak valid → jangan tulis penanda; tulis "Review sebelum PR tidak berlaku: isi berubah setelah review". Sidik ini membandingkan blob per file, jadi perubahan whitespace/indentasi pun terdeteksi; rebase yang tidak menyentuh file PR tidak mengubahnya.
- `head`: `git rev-parse HEAD` yang di-push.
- Verdict review "tidak bisa dinilai" → jangan tulis penanda.
- Tanpa hasil review (mis. `/push-pr` langsung atau `review=never`): tanpa bagian *Review* dan tanpa penanda. `review-pr` akan mereview penuh.

`gh` tidak login / tidak ada: jangan login atas nama user. Tampilkan judul + isi PR siap tempel dan URL `https://github.com/<owner>/<repo>/compare/<base>...<branch>?expand=1` (owner/repo dari `git remote get-url origin`).

### 8. Laporan
Branch, commit, hasil test (berangka), breaking change (atau "tidak ada"), URL PR dan status draft-nya, dan apa yang tidak diperiksa beserta risikonya.

## Batas
- Tidak pernah: push ke `<base>`, `--force`, `--force-with-lease` tanpa nilai lease dari gerbang tulis ulang, merge PR, menghapus branch remote, `--no-verify`.
- Tidak mematikan proses user yang memakai port 8080–8083.
- Mengubah riwayat yang sudah di-push (rebase, reword, squash, rename branch) hanya dengan persetujuan.
