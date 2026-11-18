CREATE TABLE IF NOT EXISTS couriers (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shipments (
    courier_code TEXT NOT NULL REFERENCES couriers(code),
    awb          TEXT NOT NULL,
    sender       TEXT NOT NULL,
    receiver     TEXT NOT NULL,
    origin       TEXT NOT NULL,
    destination  TEXT NOT NULL,
    service      TEXT NOT NULL,
    -- PICKED_UP | IN_TRANSIT | OUT_FOR_DELIVERY | DELIVERED | RETURNED
    status       TEXT NOT NULL,
    PRIMARY KEY (courier_code, awb)
);

CREATE TABLE IF NOT EXISTS tracking_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    courier_code TEXT NOT NULL,
    awb          TEXT NOT NULL,
    occurred_at  TEXT NOT NULL, -- ISO 8601 with offset, e.g. 2026-11-10T08:15:00+07:00
    location     TEXT NOT NULL,
    description  TEXT NOT NULL,
    FOREIGN KEY (courier_code, awb) REFERENCES shipments(courier_code, awb),
    UNIQUE (courier_code, awb, occurred_at)
);
