//! Dummy AWB patterns per courier (spec 002, R4).

use std::sync::LazyLock;

use regex::{Regex, RegexBuilder};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Confidence {
    // Declaration order matters: High sorts before Low (R3).
    High,
    Low,
}

impl Confidence {
    pub fn as_str(self) -> &'static str {
        match self {
            Confidence::High => "high",
            Confidence::Low => "low",
        }
    }
}

/// (courier code, anchored pattern, confidence, example AWB)
const TABLE: &[(&str, &str, Confidence, &str)] = &[
    ("sicepat", r"^00\d{10}$", Confidence::High, "004000123456"),
    ("tiki", r"^\d{12}$", Confidence::Low, "660000000001"),
    (
        "jne",
        r"^[A-Z]{3}\d[A-Z]\d{8}$",
        Confidence::High,
        "CGK1A00012345",
    ),
    ("jnt", r"^JP\d{10}$", Confidence::High, "JP1234567890"),
    ("jntcargo", r"^JC\d{10}$", Confidence::High, "JC1234567890"),
    (
        "spx",
        r"^SPXID\d{12}$",
        Confidence::High,
        "SPXID041234567890",
    ),
    (
        "lion",
        r"^\d{2}LP\d{10}$",
        Confidence::High,
        "11LP1234567890",
    ),
    ("pos", r"^P\d{13}$", Confidence::High, "P2211000123456"),
    (
        "anteraja",
        r"^1000\d{10}$",
        Confidence::High,
        "10001234567890",
    ),
    ("indah", r"^IND\d{9}$", Confidence::High, "IND123456789"),
];

struct Pattern {
    code: &'static str,
    re: Regex,
    confidence: Confidence,
}

static PATTERNS: LazyLock<Vec<Pattern>> = LazyLock::new(|| {
    TABLE
        .iter()
        .map(|&(code, pat, confidence, _)| Pattern {
            code,
            // ASCII-only so `\d` does not match non-Latin digits.
            re: RegexBuilder::new(pat)
                .unicode(false)
                .build()
                .expect("valid courier pattern"),
            confidence,
        })
        .collect()
});

#[derive(Debug, PartialEq, Eq)]
pub struct Candidate {
    pub code: &'static str,
    pub confidence: Confidence,
}

/// Returns matching couriers for an already-normalized AWB,
/// ordered high → low confidence, then by code (R3).
pub fn detect(awb: &str) -> Vec<Candidate> {
    let mut out: Vec<Candidate> = PATTERNS
        .iter()
        .filter(|p| p.re.is_match(awb))
        .map(|p| Candidate {
            code: p.code,
            confidence: p.confidence,
        })
        .collect();
    out.sort_by(|a, b| (a.confidence, a.code).cmp(&(b.confidence, b.code)));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    // R5: every example in the R4 table detects to its own courier.
    #[test]
    fn table_examples_detect_their_courier() {
        for &(code, _, confidence, example) in TABLE {
            let got = detect(example);
            assert!(
                got.contains(&Candidate { code, confidence }),
                "{example} should detect {code}, got {got:?}"
            );
        }
    }

    // R5: codes must be a subset of the canonical couriers in spec 000.
    #[test]
    fn codes_are_canonical() {
        const CANONICAL: &[&str] = &[
            "jnt", "jne", "jntcargo", "spx", "sicepat", "lion", "tiki", "pos", "indah", "anteraja",
        ];
        for &(code, ..) in TABLE {
            assert!(CANONICAL.contains(&code), "{code} is not canonical");
        }
    }

    #[test]
    fn non_ascii_digits_do_not_match() {
        assert!(detect("٠٠٤٠٠٠١٢٣٤٥٦").is_empty());
    }
}
