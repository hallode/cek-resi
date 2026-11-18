"""Dummy reference data for spec 004. All values are constants; no external source."""

ZONES = ("DALAM_KOTA", "SATU_PULAU", "ANTAR_PULAU")

# (code, name, island) — order matters: it is the order of /api/ongkir/cities.
CITIES: list[tuple[str, str, str]] = [
    ("JKT", "Jakarta", "Jawa"),
    ("BDG", "Bandung", "Jawa"),
    ("SMG", "Semarang", "Jawa"),
    ("YOG", "Yogyakarta", "Jawa"),
    ("SBY", "Surabaya", "Jawa"),
    ("MLG", "Malang", "Jawa"),
    ("MDN", "Medan", "Sumatera"),
    ("PLB", "Palembang", "Sumatera"),
    ("DPS", "Denpasar", "Bali"),
    ("BPN", "Balikpapan", "Kalimantan"),
    ("MKS", "Makassar", "Sulawesi"),
]

CITY_BY_CODE = {code: (name, island) for code, name, island in CITIES}


def _t(
    courier: str,
    service: str,
    rates: tuple[int, int, int],
    etds: tuple[tuple[int, int], tuple[int, int], tuple[int, int]],
) -> tuple[str, str, dict[str, int], dict[str, tuple[int, int]]]:
    return (
        courier,
        service,
        dict(zip(ZONES, rates, strict=True)),
        dict(zip(ZONES, etds, strict=True)),
    )


# (courier, service, rupiah per kg by zone, ETD days (min, max) by zone)
TARIFFS = [
    _t("sicepat", "REG", (8000, 12000, 25000), ((1, 1), (1, 2), (3, 5))),
    _t("sicepat", "BEST", (12000, 18000, 35000), ((1, 1), (1, 1), (1, 2))),
    _t("jne", "REG", (9000, 13000, 27000), ((1, 2), (2, 3), (3, 5))),
    _t("jne", "YES", (15000, 20000, 40000), ((1, 1), (1, 1), (1, 2))),
    _t("jnt", "EZ", (8500, 12500, 26000), ((1, 2), (2, 3), (3, 6))),
    _t("anteraja", "REG", (7500, 11500, 24000), ((1, 2), (2, 3), (4, 6))),
    _t("pos", "KILAT", (7000, 11000, 22000), ((2, 3), (3, 4), (5, 7))),
]
