package main

import (
	"os"
	"path/filepath"
)

func findProjectRoot() string {
	rootDir, err := os.Getwd()
	if err != nil {
		return "."
	}
	for {
		if _, err := os.Stat(filepath.Join(rootDir, "package.json")); err == nil {
			return rootDir
		}
		parent := filepath.Dir(rootDir)
		if parent == rootDir {
			return "."
		}
		rootDir = parent
	}
}
