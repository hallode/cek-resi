import pytest

from app.validation import RequestError, parse_request

MISSING = "parameter origin, destination, dan weight wajib diisi"
WEIGHT = "weight harus bilangan bulat 1-50000 gram"
DIM = "dimensi harus bilangan bulat 1-200 cm"
PARTIAL = "length, width, height harus diisi semua atau tidak sama sekali"


def ok(**kw):
    base = {
        "origin": "JKT",
        "destination": "BDG",
        "weight": "1000",
        "length": None,
        "width": None,
        "height": None,
    }
    return parse_request(**{**base, **kw})


def test_valid_request_is_normalized():
    req = ok(origin=" jkt ", destination="dps")
    assert (req.origin, req.destination, req.weight_g, req.dims) == ("JKT", "DPS", 1000, None)


def test_valid_dimensions_are_parsed():
    assert ok(length="30", width="20", height="20").dims == (30, 20, 20)


@pytest.mark.parametrize("value", [None, ""])
def test_empty_or_missing_counts_as_not_given(value):
    for field in ("origin", "destination", "weight"):
        with pytest.raises(RequestError, match=MISSING):
            ok(**{field: value})
    assert ok(length=value, width=value, height=value).dims is None


@pytest.mark.parametrize(
    "weight", ["0", "50001", "1.5", "1_000", "-5", "+5", " 5", "5 ", "abc", "٣"]
)
def test_weight_must_be_strict_integer_in_range(weight):
    with pytest.raises(RequestError, match=WEIGHT):
        ok(weight=weight)


@pytest.mark.parametrize("weight", ["1", "50000", "007"])
def test_weight_boundaries_accepted(weight):
    assert ok(weight=weight).weight_g == int(weight)


@pytest.mark.parametrize("value", ["0", "201", "abc", "-1", "1.5", "1_0", " 5"])
def test_dimension_must_be_strict_integer_in_range(value):
    with pytest.raises(RequestError, match=DIM):
        ok(length=value, width="10", height="10")


@pytest.mark.parametrize("dims", [("10", None, None), ("10", "10", None), (None, "5", "5")])
def test_partial_dimensions(dims):
    with pytest.raises(RequestError, match=PARTIAL):
        ok(length=dims[0], width=dims[1], height=dims[2])


def test_unknown_cities():
    with pytest.raises(RequestError, match="kota asal tidak dikenal"):
        ok(origin="XXX")
    with pytest.raises(RequestError, match="kota tujuan tidak dikenal"):
        ok(destination="XXX")


def test_validation_order():
    # missing beats everything
    with pytest.raises(RequestError, match=MISSING):
        ok(origin="XXX", weight=None)
    # origin beats destination beats weight beats partial beats dimension range
    with pytest.raises(RequestError, match="kota asal tidak dikenal"):
        ok(origin="XXX", destination="YYY", weight="0")
    with pytest.raises(RequestError, match="kota tujuan tidak dikenal"):
        ok(destination="YYY", weight="0")
    with pytest.raises(RequestError, match=WEIGHT):
        ok(weight="0", length="10")
    with pytest.raises(RequestError, match=PARTIAL):
        ok(length="201", width="10")
