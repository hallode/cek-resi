// Package spectest runs language-neutral spec cases (specs/*/cases*.json)
// against an http.Handler. Matching rules: specs/README.md#format-casesjson.
package spectest

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

type File struct {
	Spec   string `json:"spec"`
	Level  string `json:"level"`
	Target string `json:"target"`
	Cases  []Case `json:"cases"`
}

type Case struct {
	Name    string `json:"name"`
	Target  string `json:"target"`
	Request struct {
		Method string          `json:"method"`
		Path   string          `json:"path"`
		Body   json.RawMessage `json:"body"`
	} `json:"request"`
	Expect struct {
		Status int             `json:"status"`
		Body   json.RawMessage `json:"body"`
	} `json:"expect"`
}

// Load reads a cases file given relative to the repo root,
// e.g. "specs/000-architecture/cases.json".
func Load(t testing.TB, rel string) File {
	t.Helper()
	root, err := repoRoot()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(root, rel))
	if err != nil {
		t.Fatalf("read %s: %v", rel, err)
	}
	var f File
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatalf("parse %s: %v", rel, err)
	}
	return f
}

// Run executes every case whose target (case-level, else file-level) equals target.
func Run(t *testing.T, h http.Handler, f File, target string) {
	t.Helper()
	ran := 0
	for _, c := range f.Cases {
		if c.Target == "" {
			c.Target = f.Target
		}
		if c.Target != target {
			continue
		}
		ran++
		t.Run(c.Name, func(t *testing.T) {
			req := httptest.NewRequest(c.Request.Method, c.Request.Path, bytes.NewReader(c.Request.Body))
			if len(c.Request.Body) > 0 {
				req.Header.Set("Content-Type", "application/json")
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if rec.Code != c.Expect.Status {
				t.Errorf("status = %d, want %d; body = %s", rec.Code, c.Expect.Status, rec.Body)
			}
			if len(c.Expect.Body) == 0 {
				return
			}
			var want, got any
			if err := json.Unmarshal(c.Expect.Body, &want); err != nil {
				t.Fatalf("parse expected body: %v", err)
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
				t.Fatalf("response is not JSON: %v; body = %s", err, rec.Body)
			}
			for _, m := range Match(want, got, "$") {
				t.Error(m)
			}
		})
	}
	if ran == 0 {
		t.Fatalf("%s: no cases for target %q", f.Spec, target)
	}
}

// Match compares expected against actual using partial deep match and
// returns one message per mismatch.
func Match(want, got any, path string) []string {
	switch w := want.(type) {
	case map[string]any:
		if n, ok := w["$length"]; ok && len(w) == 1 {
			arr, isArr := got.([]any)
			if !isArr || float64(len(arr)) != n {
				return []string{fmt.Sprintf("%s: want array of length %v, got %v", path, n, got)}
			}
			return nil
		}
		obj, ok := got.(map[string]any)
		if !ok {
			return []string{fmt.Sprintf("%s: want object, got %v", path, got)}
		}
		var out []string
		for k, v := range w {
			g, ok := obj[k]
			if !ok {
				out = append(out, fmt.Sprintf("%s.%s: missing", path, k))
				continue
			}
			out = append(out, Match(v, g, path+"."+k)...)
		}
		return out
	case []any:
		arr, ok := got.([]any)
		if !ok || len(arr) != len(w) {
			return []string{fmt.Sprintf("%s: want array of length %d, got %v", path, len(w), got)}
		}
		var out []string
		for i := range w {
			out = append(out, Match(w[i], arr[i], fmt.Sprintf("%s[%d]", path, i))...)
		}
		return out
	default:
		if want != got {
			return []string{fmt.Sprintf("%s: want %#v, got %#v", path, want, got)}
		}
		return nil
	}
}

// repoRoot walks up from the working directory until it finds specs/.
func repoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if fi, err := os.Stat(filepath.Join(dir, "specs")); err == nil && fi.IsDir() {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("specs/ not found above working directory")
		}
		dir = parent
	}
}
