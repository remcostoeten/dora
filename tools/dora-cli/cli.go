package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"
)

func runCLI(args []string) error {
	if len(args) == 0 {
		return nil
	}

	switch args[0] {
	case "vm":
		return runVMCommand(args[1:])
	case "ci":
		return runCICommand(args[1:])
	case "help", "-h", "--help":
		printCLIUsage()
		return nil
	default:
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func runCICommand(args []string) error {
	if len(args) == 0 {
		return errors.New("missing ci subcommand (expected: mac)")
	}
	if args[0] != "mac" {
		return fmt.Errorf("unknown ci subcommand %q", args[0])
	}

	fs := flag.NewFlagSet("ci mac", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	ref := fs.String("ref", "main", "Git ref (branch/tag) to dispatch")
	workflow := fs.String("workflow", "ci-mac.yml", "Workflow file name or workflow id")
	repo := fs.String("repo", "", "Override repo (owner/name). Defaults to current git remote")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}

	ghArgs := []string{"workflow", "run", *workflow, "--ref", *ref}
	if strings.TrimSpace(*repo) != "" {
		ghArgs = append(ghArgs, "--repo", *repo)
	}
	return runCommandStreaming("gh", ghArgs...)
}

func printCLIUsage() {
	fmt.Println("dora CLI")
	fmt.Println("")
	fmt.Println("Usage:")
	fmt.Println("  dora                 # interactive TUI")
	fmt.Println("  dora vm <subcommand> [flags]")
	fmt.Println("  dora ci mac [--ref main] [--workflow ci-mac.yml]")
	fmt.Println("")
	fmt.Println("VM subcommands:")
	fmt.Println("  init    initialize VM config/storage")
	fmt.Println("  ensure  create/define/start VM")
	fmt.Println("  run     run command inside guest via qemu guest agent")
	fmt.Println("  logs    show VM state/log pointers")
	fmt.Println("  clean   stop VM and clean ephemeral artifacts")
	fmt.Println("  nuke    undefine VM and remove all managed artifacts")
}
