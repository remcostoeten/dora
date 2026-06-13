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
		return errors.New("missing ci subcommand (expected: mac | dispatch)")
	}

	sub := args[0]

	// Legacy shorthand: dora-runner ci mac
	if sub == "mac" {
		sub = "dispatch"
		args = append([]string{"dispatch", "--workflow", "ci-mac.yml"}, args[1:]...)
	}

	if sub != "dispatch" {
		return fmt.Errorf("unknown ci subcommand %q", sub)
	}

	fs := flag.NewFlagSet("ci dispatch", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	ref := fs.String("ref", "main", "Git ref (branch/tag) to dispatch")
	workflow := fs.String("workflow", "ci.yml", "Workflow file name or id")
	repo := fs.String("repo", "", "Override repo (owner/name)")
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
	fmt.Println("dora runner")
	fmt.Println("")
	fmt.Println("Usage:")
	fmt.Println("  dora-runner              # interactive TUI")
	fmt.Println("  dora-runner vm <subcommand> [flags]")
  fmt.Println("  dora-runner ci dispatch [--workflow ci.yml] [--ref main]")
	fmt.Println("  dora-runner ci mac [--ref main]  (shorthand for ci dispatch --workflow ci-mac.yml)")
	fmt.Println("")
	fmt.Println("VM subcommands:")
	fmt.Println("  init    initialize VM config/storage")
	fmt.Println("  ensure  create/define/start VM")
	fmt.Println("  run     run command inside guest via qemu guest agent")
	fmt.Println("  logs    show VM state/log pointers")
	fmt.Println("  clean   stop VM and clean ephemeral artifacts")
	fmt.Println("  nuke    undefine VM and remove all managed artifacts")
}
