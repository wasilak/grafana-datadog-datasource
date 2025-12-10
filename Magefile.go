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
	if err := sh.RunWith(
		map[string]string{
			"GO111MODULE": "on",
		},
		"go",
		"build",
		"-o", output,
		"-ldflags", "-s -w",
		"./pkg",
	); err != nil {
		return err
	}

	// Create a generic named executable that matches plugin.json
	genericOutput := filepath.Join("dist", "gpx_wasilak_datadog_datasource")
	if runtime.GOOS == "windows" {
		genericOutput += ".exe"
	}

	fmt.Printf("Creating generic executable: %s\n", genericOutput)
	return sh.Copy(genericOutput, output)
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

// BackendDarwin builds the macOS backend binary for Intel
func (Build) BackendDarwin() error {
	os.MkdirAll("dist", 0755)

	output := filepath.Join("dist", "gpx_wasilak_datadog_datasource_darwin_amd64")
	fmt.Printf("Building macOS backend (Intel) -> %s\n", output)

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

// BackendDarwinArm builds the macOS backend binary for Apple Silicon
func (Build) BackendDarwinArm() error {
	os.MkdirAll("dist", 0755)

	output := filepath.Join("dist", "gpx_wasilak_datadog_datasource_darwin_arm64")
	fmt.Printf("Building macOS backend (Apple Silicon) -> %s\n", output)

	return sh.RunWith(
		map[string]string{
			"GO111MODULE": "on",
			"GOOS":        "darwin",
			"GOARCH":      "arm64",
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
// BuildAll builds backend binaries for all supported platforms
func BuildAll() error {
	fmt.Println("Building backend for all platforms...")
	
	build := Build{}
	
	if err := build.BackendLinux(); err != nil {
		return fmt.Errorf("failed to build Linux backend: %w", err)
	}
	
	if err := build.BackendLinuxArm(); err != nil {
		return fmt.Errorf("failed to build Linux ARM backend: %w", err)
	}
	
	if err := build.BackendDarwin(); err != nil {
		return fmt.Errorf("failed to build macOS Intel backend: %w", err)
	}
	
	if err := build.BackendDarwinArm(); err != nil {
		return fmt.Errorf("failed to build macOS ARM backend: %w", err)
	}
	
	if err := build.BackendWindows(); err != nil {
		return fmt.Errorf("failed to build Windows backend: %w", err)
	}
	
	fmt.Println("✓ All backend binaries built successfully")
	return nil
}

// Coverage is a mock target for compatibility with GitHub Actions
// The actual coverage is handled by the frontend test suite
func Coverage() error {
	fmt.Println("Coverage target called - this is a mock for GitHub Actions compatibility")
	fmt.Println("Frontend coverage is handled by Jest test suite")
	fmt.Println("Backend coverage would require additional setup")
	return nil
}