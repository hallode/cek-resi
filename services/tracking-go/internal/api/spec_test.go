package api

import (
	"testing"

	"github.com/hallode/cek-resi/services/tracking-go/internal/spectest"
)

// specFiles lists the spec cases this service implements. Add an entry when
// a spec owned by tracking-go is implemented.
var specFiles = []string{
	"specs/000-architecture/cases.json",
}

func TestSpecs(t *testing.T) {
	mux := newServer(t)
	for _, f := range specFiles {
		spec := spectest.Load(t, f)
		t.Run(spec.Spec, func(t *testing.T) {
			spectest.Run(t, mux, spec, "tracking-go")
		})
	}
}
