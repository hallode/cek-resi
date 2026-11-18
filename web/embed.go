// Package web holds the static frontend, embedded into the binary.
package web

import "embed"

//go:embed index.html app.js style.css
var FS embed.FS
