import pytest
from fastapi.testclient import TestClient

from app.main import SERVICE, app

from . import spectest

# Spec cases this service implements. Add an entry when a spec owned by
# ongkir-py is implemented (e.g. specs/004-ongkir/cases.json).
SPEC_FILES = ["specs/000-architecture/cases.json", "specs/004-ongkir/cases.json"]


@pytest.mark.parametrize("rel", SPEC_FILES)
def test_specs(rel: str) -> None:
    failures = spectest.run_cases(TestClient(app), spectest.load(rel), SERVICE)
    assert not failures, "\n" + "\n".join(failures)


@pytest.mark.parametrize(
    "case", spectest.load("specs/matcher-cases.json")["cases"], ids=lambda c: c["name"]
)
def test_match_partial_follows_shared_vectors(case: dict) -> None:
    errs = spectest.match_partial(case["expected"], case["actual"])
    assert (not errs) == case["match"], errs
