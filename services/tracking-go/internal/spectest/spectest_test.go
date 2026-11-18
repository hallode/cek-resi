package spectest

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestMatch(t *testing.T) {
	root, err := repoRoot()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(root, "specs/matcher-cases.json"))
	if err != nil {
		t.Fatal(err)
	}
	var vectors struct {
		Cases []struct {
			Name     string `json:"name"`
			Expected any    `json:"expected"`
			Actual   any    `json:"actual"`
			Match    bool   `json:"match"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(raw, &vectors); err != nil {
		t.Fatal(err)
	}
	for _, v := range vectors.Cases {
		t.Run(v.Name, func(t *testing.T) {
			errs := Match(v.Expected, v.Actual, "$")
			if (len(errs) == 0) != v.Match {
				t.Fatalf("match = %v, want %v (errs: %v)", len(errs) == 0, v.Match, errs)
			}
		})
	}
}
