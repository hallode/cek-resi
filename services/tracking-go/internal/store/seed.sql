-- Dummy data. Safe to run repeatedly (INSERT OR IGNORE).

INSERT OR IGNORE INTO couriers (code, name) VALUES
    ('jnt',      'J&T Express'),
    ('jne',      'JNE Express'),
    ('jntcargo', 'J&T Cargo'),
    ('spx',      'SPX Express'),
    ('sicepat',  'SiCepat Ekspres'),
    ('lion',     'Lion Parcel'),
    ('tiki',     'TIKI'),
    ('pos',      'Pos Indonesia'),
    ('indah',    'Indah Cargo'),
    ('anteraja', 'Anteraja');

INSERT OR IGNORE INTO shipments (courier_code, awb, sender, receiver, origin, destination, service, status) VALUES
    ('sicepat',  '004000123456',      'Budi Santoso',   'Siti Aminah',    'Jakarta Barat',   'Bandung',      'REG',     'DELIVERED'),
    ('sicepat',  '004000654321',      'Toko Kain Jaya', 'Andi Wijaya',    'Surabaya',        'Medan',        'BEST',    'IN_TRANSIT'),
    ('jne',      'CGK1A00012345',     'Rina Kartika',   'Dewi Lestari',   'Jakarta Pusat',   'Yogyakarta',   'YES',     'OUT_FOR_DELIVERY'),
    ('jnt',      'JP1234567890',      'Gadget Store',   'Hendra Gunawan', 'Tangerang',       'Semarang',     'EZ',      'DELIVERED'),
    ('spx',      'SPXID041234567890', 'Shopee Seller',  'Putri Ayu',      'Bekasi',          'Makassar',     'Standard','PICKED_UP'),
    ('anteraja', '10001234567890',    'Fashion Kita',   'Wayan Sudarma',  'Depok',           'Denpasar',     'Regular', 'RETURNED'),
    ('lion',     '11LP1234567890',    'Agus Salim',     'Fajar Nugroho',  'Jakarta Timur',   'Balikpapan',   'REGPACK', 'IN_TRANSIT'),
    ('pos',      'P2211000123456',    'Lina Marlina',   'Rudi Hartono',   'Malang',          'Jakarta Selatan','Kilat Khusus','DELIVERED');

INSERT OR IGNORE INTO tracking_events (courier_code, awb, occurred_at, location, description) VALUES
    ('sicepat', '004000123456', '2026-11-10T09:12:00+07:00', 'Jakarta Barat',  'Paket telah di-pickup oleh kurir'),
    ('sicepat', '004000123456', '2026-11-10T15:40:00+07:00', 'Jakarta Barat',  'Paket diterima di gerai SiCepat Kebon Jeruk'),
    ('sicepat', '004000123456', '2026-11-10T22:05:00+07:00', 'Jakarta',        'Paket keluar dari Sorting Center Jakarta'),
    ('sicepat', '004000123456', '2026-11-11T06:30:00+07:00', 'Bandung',        'Paket tiba di Sorting Center Bandung'),
    ('sicepat', '004000123456', '2026-11-11T09:15:00+07:00', 'Bandung',        'Paket dibawa kurir menuju alamat penerima'),
    ('sicepat', '004000123456', '2026-11-11T13:47:00+07:00', 'Bandung',        'Paket diterima oleh Siti Aminah (Yang bersangkutan)'),

    ('sicepat', '004000654321', '2026-11-15T10:00:00+07:00', 'Surabaya',       'Paket telah di-pickup oleh kurir'),
    ('sicepat', '004000654321', '2026-11-15T18:20:00+07:00', 'Surabaya',       'Paket keluar dari Sorting Center Surabaya'),
    ('sicepat', '004000654321', '2026-11-16T21:05:00+07:00', 'Jakarta',        'Paket transit di Hub Jakarta'),

    ('jne', 'CGK1A00012345', '2026-11-16T11:00:00+07:00', 'Jakarta Pusat', 'SHIPMENT RECEIVED BY JNE COUNTER OFFICER AT [JAKARTA]'),
    ('jne', 'CGK1A00012345', '2026-11-16T20:30:00+07:00', 'Jakarta',       'PROCESSED AT SORTING CENTER [JAKARTA]'),
    ('jne', 'CGK1A00012345', '2026-11-17T05:10:00+07:00', 'Yogyakarta',    'RECEIVED AT INBOUND STATION [YOGYAKARTA]'),
    ('jne', 'CGK1A00012345', '2026-11-17T08:45:00+07:00', 'Yogyakarta',    'WITH DELIVERY COURIER [YOGYAKARTA]'),

    ('jnt', 'JP1234567890', '2026-11-08T14:00:00+07:00', 'Tangerang', 'Paket telah diterima oleh J&T Tangerang'),
    ('jnt', 'JP1234567890', '2026-11-08T23:15:00+07:00', 'Tangerang', 'Paket akan dikirimkan ke Semarang Gateway'),
    ('jnt', 'JP1234567890', '2026-11-09T19:40:00+07:00', 'Semarang',  'Paket telah sampai di Semarang Gateway'),
    ('jnt', 'JP1234567890', '2026-11-10T08:05:00+07:00', 'Semarang',  'Paket sedang diantar oleh kurir'),
    ('jnt', 'JP1234567890', '2026-11-10T11:22:00+07:00', 'Semarang',  'Paket telah diterima oleh Hendra Gunawan'),

    ('spx', 'SPXID041234567890', '2026-11-17T16:00:00+07:00', 'Bekasi', 'Pesanan dibuat, menunggu pickup'),
    ('spx', 'SPXID041234567890', '2026-11-18T09:30:00+07:00', 'Bekasi', 'Paket telah di-pickup oleh kurir SPX'),
    ('spx', 'SPXID041234567890', '2026-11-18T13:10:00+07:00', 'Bekasi', 'Paket diterima di First Mile Hub Bekasi'),

    ('anteraja', '10001234567890', '2026-11-01T10:00:00+07:00', 'Depok',    'Paket di-pickup oleh Satria Anteraja'),
    ('anteraja', '10001234567890', '2026-11-02T22:00:00+07:00', 'Jakarta',  'Paket diproses di hub Jakarta'),
    ('anteraja', '10001234567890', '2026-11-04T07:30:00+07:00', 'Denpasar', 'Paket tiba di hub Denpasar'),
    ('anteraja', '10001234567890', '2026-11-04T14:00:00+07:00', 'Denpasar', 'Pengiriman gagal: alamat tidak ditemukan'),
    ('anteraja', '10001234567890', '2026-11-06T14:00:00+07:00', 'Denpasar', 'Pengiriman gagal: penerima tidak dapat dihubungi'),
    ('anteraja', '10001234567890', '2026-11-07T09:00:00+07:00', 'Denpasar', 'Paket diretur ke pengirim'),
    ('anteraja', '10001234567890', '2026-11-11T15:20:00+07:00', 'Depok',    'Paket retur diterima oleh pengirim'),

    ('lion', '11LP1234567890', '2026-11-16T13:00:00+07:00', 'Jakarta Timur', 'Paket diterima di agen Lion Parcel'),
    ('lion', '11LP1234567890', '2026-11-17T02:15:00+07:00', 'Jakarta',       'Paket diberangkatkan via udara CGK-BPN'),
    ('lion', '11LP1234567890', '2026-11-17T10:40:00+07:00', 'Balikpapan',    'Paket tiba di hub Balikpapan'),

    ('pos', 'P2211000123456', '2026-11-05T09:00:00+07:00', 'Malang',          'Posting loket Kantor Pos Malang'),
    ('pos', 'P2211000123456', '2026-11-05T20:00:00+07:00', 'Malang',          'Diteruskan ke Mail Processing Center Malang'),
    ('pos', 'P2211000123456', '2026-11-07T04:30:00+07:00', 'Jakarta',         'Tiba di Mail Processing Center Jakarta'),
    ('pos', 'P2211000123456', '2026-11-07T10:00:00+07:00', 'Jakarta Selatan', 'Antaran ke alamat penerima'),
    ('pos', 'P2211000123456', '2026-11-07T14:35:00+07:00', 'Jakarta Selatan', 'Selesai antar, diterima Rudi Hartono');
