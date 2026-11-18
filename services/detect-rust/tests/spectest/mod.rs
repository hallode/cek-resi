//! Runs language-neutral spec cases (specs/*/cases*.json) against an axum Router.
//! Matching rules: specs/README.md#format-casesjson.

use std::path::{Path, PathBuf};

use axum::{Router, body::Body, http::Request};
use http_body_util::BodyExt;
use serde::{Deserialize, de::DeserializeOwned};
use serde_json::Value;
use tower::ServiceExt;

#[derive(Deserialize)]
pub struct SpecFile {
    pub spec: String,
    pub target: String,
    pub cases: Vec<Case>,
}

#[derive(Deserialize)]
pub struct Case {
    pub name: String,
    pub target: Option<String>,
    pub request: CaseRequest,
    pub expect: CaseExpect,
}

#[derive(Deserialize)]
pub struct CaseRequest {
    pub method: String,
    pub path: String,
    pub body: Option<Value>,
}

#[derive(Deserialize)]
pub struct CaseExpect {
    pub status: u16,
    pub body: Option<Value>,
}

/// The repo root: first ancestor of this crate that contains `specs/`.
pub fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .find(|dir| dir.join("specs").is_dir())
        .expect("specs/ not found above CARGO_MANIFEST_DIR")
        .to_path_buf()
}

/// Loads a JSON file given relative to the repo root.
pub fn load<T: DeserializeOwned>(rel: &str) -> T {
    let path = repo_root().join(rel);
    let raw = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {rel}: {e}"));
    serde_json::from_str(&raw).unwrap_or_else(|e| panic!("parse {rel}: {e}"))
}

/// Partial deep match; returns one message per mismatch (empty = match).
pub fn match_partial(expected: &Value, actual: &Value, path: &str) -> Vec<String> {
    match expected {
        Value::Object(want) if want.len() == 1 && want.contains_key("$length") => {
            match (actual.as_array(), want["$length"].as_u64()) {
                (Some(arr), Some(n)) if arr.len() as u64 == n => vec![],
                _ => vec![format!(
                    "{path}: want array of length {}, got {actual}",
                    want["$length"]
                )],
            }
        }
        Value::Object(want) => match actual.as_object() {
            None => vec![format!("{path}: want object, got {actual}")],
            Some(got) => want
                .iter()
                .flat_map(|(k, v)| match got.get(k) {
                    Some(g) => match_partial(v, g, &format!("{path}.{k}")),
                    None => vec![format!("{path}.{k}: missing")],
                })
                .collect(),
        },
        Value::Array(want) => match actual.as_array() {
            Some(got) if got.len() == want.len() => want
                .iter()
                .zip(got)
                .enumerate()
                .flat_map(|(i, (w, g))| match_partial(w, g, &format!("{path}[{i}]")))
                .collect(),
            _ => vec![format!(
                "{path}: want array of length {}, got {actual}",
                want.len()
            )],
        },
        _ if expected == actual => vec![],
        _ => vec![format!("{path}: want {expected}, got {actual}")],
    }
}

/// Runs every case whose target (case-level, else file-level) equals `target`.
/// Panics once at the end, listing every failing case.
pub async fn run_cases(app: Router, file: &SpecFile, target: &str) {
    let cases: Vec<&Case> = file
        .cases
        .iter()
        .filter(|c| c.target.as_deref().unwrap_or(&file.target) == target)
        .collect();
    assert!(
        !cases.is_empty(),
        "{}: no cases for target {target}",
        file.spec
    );

    let mut failures = Vec::new();
    for c in cases {
        let mut req = Request::builder()
            .method(c.request.method.as_str())
            .uri(&c.request.path);
        let body = match &c.request.body {
            Some(b) => {
                req = req.header("content-type", "application/json");
                Body::from(b.to_string())
            }
            None => Body::empty(),
        };
        let res = app.clone().oneshot(req.body(body).unwrap()).await.unwrap();
        let status = res.status().as_u16();
        let bytes = res.into_body().collect().await.unwrap().to_bytes();

        let mut errs = Vec::new();
        if status != c.expect.status {
            errs.push(format!("status = {status}, want {}", c.expect.status));
        }
        if let Some(want) = &c.expect.body {
            match serde_json::from_slice::<Value>(&bytes) {
                Ok(got) => errs.extend(match_partial(want, &got, "$")),
                Err(e) => errs.push(format!("response is not JSON: {e}")),
            }
        }
        if !errs.is_empty() {
            failures.push(format!(
                "{} / {}:\n    {}",
                file.spec,
                c.name,
                errs.join("\n    ")
            ));
        }
    }
    assert!(failures.is_empty(), "\n{}", failures.join("\n"));
}
