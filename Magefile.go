//go:build mage
// +build mage

package main

import (
	"github.com/magefile/mage/mg"

	// mage:import
	build "github.com/grafana/grafana-plugin-sdk-go/build"
)

// Default configures the default target.
var Default = build.BuildAll

// BuildAllSequential builds the backend for all platforms one at a time.
// The SDK's BuildAll runs all six static builds in parallel, which runs
// GitHub-hosted runners out of memory and kills the job without an error.
func BuildAllSequential() {
	b := build.Build{}
	mg.SerialDeps(b.Linux, b.Windows, b.Darwin, b.DarwinARM64, b.LinuxARM64, b.LinuxARM)
}
