// +build mage

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"
)

// Build represents build-related tasks
type Build mg.Namespace

// Backend builds the Go backend plugin
func (Build) Backend() error {
	os.MkdirAll("dist", 0755)

	// Determine output filename based on OS
	var output string
	switch runtime.GOOS {
	case "linux":
		output = filepath.Join("dist", "gpx_wasilak_datadog_datasource_linux_x64")
	case "darwin":
		if runtime.GOARCH == "arm64" {
			output = filepath.Join("dist", "gpx_wasilak_datadog_datasource_darwin_arm64")
		} else {
			output = filepath.Join("dist", "gpx_wasilak_datadog_datasource_darwin_x64")
		}
	case "windows":
		output = filepath.Join("dist", "gpx_wasilak_datadog_datasource_windows_x64.exe")
	default:
		return fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}

	fmt.Printf("Building Go backend for %s/%s -> %s\n", runtime.GOOS, runtime.GOARCH, output)

	// Build the Go binary
	return sh.RunWith(
		map[string]string{
			"GO111MODULE": "on",
		},
		"go",
		"build",
		"-o", output,
		"-ldflags", "-s -w",
		"./pkg",
	)
}

// BackendLinux builds the Linux backend binary for x86-64
func (Build) BackendLinux() error {
	os.MkdirAll("dist", 0755)

	output := filepath.Join("dist", "gpx_wasilak_datadog_datasource_linux_x64")
	fmt.Printf("Building Linux backend (x86-64) -> %s\n", output)

	return sh.RunWith(
		map[string]string{
			"GO111MODULE": "on",
			"GOOS":        "linux",
			"GOARCH":      "amd64",
		},
		"go",
		"build",
		"-o", output,
		"-ldflags", "-s -w",
		"./pkg",
	)
}

// BackendLinuxArm builds the Linux backend binary for ARM64
func (Build) BackendLinuxArm() error {
	os.MkdirAll("dist", 0755)

	output := filepath.Join("dist", "gpx_wasilak_datadog_datasource_linux_arm64")
	fmt.Printf("Building Linux backend (ARM64) -> %s\n", output)

	return sh.RunWith(
		map[string]string{
			"GO111MODULE": "on",
			"GOOS":        "linux",
			"GOARCH":      "arm64",
		},
		"go",
		"build",
		"-o", output,
		"-ldflags", "-s -w",
		"./pkg",
	)
}

// BackendDarwin builds the macOS backend binary
func (Build) BackendDarwin() error {
	os.MkdirAll("dist", 0755)

	output := filepath.Join("dist", "gpx_wasilak_datadog_datasource_darwin_x64")
	fmt.Printf("Building macOS backend -> %s\n", output)

	return sh.RunWith(
		map[string]string{
			"GO111MODULE": "on",
			"GOOS":        "darwin",
			"GOARCH":      "amd64",
		},
		"go",
		"build",
		"-o", output,
		"-ldflags", "-s -w",
		"./pkg",
	)
}

// BackendWindows builds the Windows backend binary
func (Build) BackendWindows() error {
	os.MkdirAll("dist", 0755)

	output := filepath.Join("dist", "gpx_wasilak_datadog_datasource_windows_x64.exe")
	fmt.Printf("Building Windows backend -> %s\n", output)

	return sh.RunWith(
		map[string]string{
			"GO111MODULE": "on",
			"GOOS":        "windows",
			"GOARCH":      "amd64",
		},
		"go",
		"build",
		"-o", output,
		"-ldflags", "-s -w",
		"./pkg",
	)
}
