import pytest

from app.pricing import billable_weight_kg, quote, zone


@pytest.mark.parametrize(
    ("weight_g", "dims", "want"),
    [
        (1, None, 1),
        (300, None, 1),
        (1000, None, 1),
        (1001, None, 2),
        (1500, None, 2),
        (50000, None, 50),
        (1000, (30, 20, 20), 2),  # volumetric 12000/6000 beats actual 1 kg
        (5000, (10, 10, 10), 5),  # actual beats smaller volumetric
        (1500, (30, 30, 10), 2),  # tie: both 9000 units
        (1000, (10, 20, 30), 1),  # tie at exactly 1 kg
        (1000, (1, 1, 1), 1),
        (1000, (200, 200, 200), 1334),  # 8_000_000 / 6000 rounded up
    ],
)
def test_billable_weight_kg(weight_g, dims, want):
    assert billable_weight_kg(weight_g, dims) == want


@pytest.mark.parametrize(
    ("origin", "dest", "want"),
    [
        ("JKT", "JKT", "DALAM_KOTA"),
        ("JKT", "BDG", "SATU_PULAU"),
        ("MDN", "PLB", "SATU_PULAU"),
        ("JKT", "DPS", "ANTAR_PULAU"),
        ("SBY", "MDN", "ANTAR_PULAU"),
    ],
)
def test_zone(origin, dest, want):
    assert zone(origin, dest) == want


def test_quote_sorted_by_price_then_courier_then_service():
    options = quote("JKT", "BDG", 2)
    keys = [(o["price"], o["courier"], o["service"]) for o in options]
    assert keys == sorted(keys)
    assert len(options) == 7


def test_quote_price_is_rate_times_billable_kg():
    by_key = {(o["courier"], o["service"]): o for o in quote("JKT", "BDG", 2)}
    assert by_key[("pos", "KILAT")]["price"] == 22000
    assert by_key[("pos", "KILAT")]["etd_days"] == {"min": 3, "max": 4}
    assert by_key[("jne", "YES")]["price"] == 40000


def test_quote_breaks_price_ties_by_courier_then_service(monkeypatch):
    from app import data, pricing

    tariffs = [
        ("b", "Z", {"DALAM_KOTA": 1000}, {"DALAM_KOTA": (1, 1)}),
        ("b", "A", {"DALAM_KOTA": 1000}, {"DALAM_KOTA": (1, 1)}),
        ("a", "Z", {"DALAM_KOTA": 1000}, {"DALAM_KOTA": (1, 1)}),
    ]
    monkeypatch.setattr(data, "TARIFFS", tariffs)
    monkeypatch.setattr(pricing, "TARIFFS", tariffs)
    got = [(o["courier"], o["service"]) for o in pricing.quote("JKT", "JKT", 1)]
    assert got == [("a", "Z"), ("b", "A"), ("b", "Z")]
