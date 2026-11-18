# cek-resi

Aplikasi cek resi multi-kurir (mirip cekresi.com/top) dengan data dummy. Monorepo polyglot, satu service per bahasa, dikembangkan spec-driven.

| Service | Bahasa | Port |
|---|---|---|
| `gateway-ts` — serve UI + proxy API | TypeScript | 8080 |
| `tracking-go` — data resi & kurir | Go | 8081 |
| `detect-rust` — deteksi kurir dari nomor resi | Rust | 8082 |
| `ongkir-py` — cek ongkir (skeleton) | Python | 8083 |

## Quickstart

Butuh [mise](https://mise.jdx.dev) — sisanya (Go, Node, Rust, Python, uv) dipasang otomatis.

```sh
mise install        # toolchain ter-pin di mise.toml
mise run setup      # dependency semua service
mise run dev        # buka http://localhost:8080
mise run test       # test semua service
mise run lint
mise run scan       # cek kerentanan dependency ke osv.dev (butuh jaringan)
```

Satu service saja: `mise run test:detect`, `mise run dev:tracking`, dst (`tracking|gateway|detect|ongkir`).

Test e2e (semua service harus hidup lewat `mise run dev`): `cd services/gateway-ts && npm run test:e2e`.

```sh
curl 'localhost:8080/api/detect?awb=004000123456'   # kandidat kurir
curl 'localhost:8080/api/track?awb=JP1234567890'    # tanpa courier → deteksi otomatis
```

## Resi dummy

| Kurir | No Resi | Status |
|---|---|---|
| SiCepat | `004000123456` | DELIVERED |
| SiCepat | `004000654321` | IN_TRANSIT |
| JNE | `CGK1A00012345` | OUT_FOR_DELIVERY |
| J&T | `JP1234567890` | DELIVERED |
| SPX | `SPXID041234567890` | PICKED_UP |
| Anteraja | `10001234567890` | RETURNED |
| Lion | `11LP1234567890` | IN_TRANSIT |
| Pos | `P2211000123456` | DELIVERED |

## Dokumen

- [AGENTS.md](AGENTS.md) — aturan monorepo & checklist service baru
- [specs/](specs/README.md) — spec + test vector lintas bahasa
