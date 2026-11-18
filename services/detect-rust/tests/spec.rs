mod spectest;

use serde::Deserialize;
use serde_json::Value;

/// Spec cases this service implements. Add an entry when a spec owned by
/// detect-rust is implemented (e.g. specs/002-courier-detection/cases.json).
const SPEC_FILES: &[&str] = &["specs/000-architecture/cases.json"];

#[tokio::test]
async fn specs() {
    for rel in SPEC_FILES {
        let file: spectest::SpecFile = spectest::load(rel);
        spectest::run_cases(detect_rust::app(), &file, detect_rust::SERVICE).await;
    }
}

#[derive(Deserialize)]
struct MatcherVectors {
    cases: Vec<MatcherCase>,
}

#[derive(Deserialize)]
struct MatcherCase {
    name: String,
    expected: Value,
    actual: Value,
    #[serde(rename = "match")]
    should_match: bool,
}

#[test]
fn match_partial_follows_shared_vectors() {
    let vectors: MatcherVectors = spectest::load("specs/matcher-cases.json");
    for v in vectors.cases {
        let errs = spectest::match_partial(&v.expected, &v.actual, "$");
        assert_eq!(errs.is_empty(), v.should_match, "{}: {errs:?}", v.name);
    }
}
