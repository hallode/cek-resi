# cek-resi

Base project aplikasi cek resi (mirip cekresi.com/top) — Go API + HTML statis, dengan database SQLite dummy.

## Jalankan

```sh
make run          # http://localhost:8080
make test
make reset-db     # hapus cekresi.db, akan di-seed ulang saat run berikutnya
```

Env: `PORT` (default `8080`), `DB_PATH` (default `cekresi.db`).

## Resi dummy

| Kurir     | No Resi             | Status            |
|-----------|---------------------|-------------------|
| SiCepat   | `004000123456`      | DELIVERED         |
| SiCepat   | `004000654321`      | IN_TRANSIT        |
| JNE       | `CGK1A00012345`     | OUT_FOR_DELIVERY  |
| J&T       | `JP1234567890`      | DELIVERED         |
| SPX       | `SPXID041234567890` | PICKED_UP         |
| Anteraja  | `10001234567890`    | RETURNED          |
| Lion      | `11LP1234567890`    | IN_TRANSIT        |
| Pos       | `P2211000123456`    | DELIVERED         |

## API

```sh
curl localhost:8080/api/couriers
curl 'localhost:8080/api/track?courier=sicepat&awb=004000123456'
```

Detail kontrak ada di [AGENTS.md](AGENTS.md#kontrak-api).
