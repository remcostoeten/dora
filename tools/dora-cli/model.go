package main

import (
	"fmt"
	"io/fs"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type subdir struct {
	label   string
	command string
	args    []string
}

type buildFile struct {
	Name    string
	Path    string
	ModTime time.Time
}

type model struct {
	mainMenu      []string
	cursor        int
	
	inSubmenu     bool
	subMenu       []subdir
	subMenuTitle  string
	subCursor     int

	viewingBuilds bool
	buildFiles    []buildFile
	buildCursor   int

	executing     bool
	spinner       spinner.Model
	outputCmd     string
	err           error
}

func initialModel() model {
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	return model{
		mainMenu: []string{
			"[1] Run all",
			"[2] Run app...",
			"[3] Build all",
			"[4] Build specific platform...",
			"[5] Run compiled builds...",
		},
		spinner: s,
	}
}

func (m model) Init() tea.Cmd {
	return m.spinner.Tick
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.executing {
			// If executing, only allow quitting if strictly needed, 
			// generally we wait for execMsg, but for simplicity here we allow force quit
			if msg.String() == "ctrl+c" {
				return m, tea.Quit
			}
			return m, nil
		}

		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "up", "k":
			if m.inSubmenu {
				if m.subCursor > 0 {
					m.subCursor--
				}
			} else if m.viewingBuilds {
				if m.buildCursor > 0 {
					m.buildCursor--
				}
			} else {
				if m.cursor > 0 {
					m.cursor--
				}
			}
		case "down", "j":
			if m.inSubmenu {
				if m.subCursor < len(m.subMenu)-1 {
					m.subCursor++
				}
			} else if m.viewingBuilds {
				if m.buildCursor < len(m.buildFiles)-1 {
					m.buildCursor++
				}
			} else {
				if m.cursor < len(m.mainMenu)-1 {
					m.cursor++
				}
			}
		case "esc", "backspace":
			if m.inSubmenu || m.viewingBuilds {
				m.inSubmenu = false
				m.viewingBuilds = false
				return m, nil
			}
			return m, tea.Quit
		case "enter", " ":
			if m.inSubmenu {
				choice := m.subMenu[m.subCursor]
				return m, executeCommand(choice.command, choice.args...)
			} else if m.viewingBuilds {
				if len(m.buildFiles) > 0 {
					file := m.buildFiles[m.buildCursor]
					return m, executeCommand(file.Path)
				}
			} else {
				// Main Menu Selection
				switch m.cursor {
				case 0: // Run all
					return m, executeCommand("bun", "run", "turbo", "dev")
				case 1: // Run app...
					m.inSubmenu = true
					m.subMenuTitle = "Select App to Run"
					m.subCursor = 0
					m.subMenu = []subdir{
						{label: "Desktop (Tauri)", command: "bun", args: []string{"run", "desktop:dev"}},
						{label: "Docs (Next.js)", command: "bun", args: []string{"run", "docs:dev"}},
						{label: "Web (Mock Mode)", command: "bun", args: []string{"run", "turbo", "dev", "--filter=@dora/desktop"}},
					}
				case 2: // Build all
					return m, executeCommand("bun", "run", "turbo", "build")
				case 3: // Build specific...
					m.inSubmenu = true
					m.subMenuTitle = "Select Build Platform"
					m.subCursor = 0
					m.subMenu = []subdir{
						{label: "AppImage", command: "bun", args: []string{"run", "tauri", "build", "--", "--bundles", "appimage"}},
						{label: "Debian (.deb)", command: "bun", args: []string{"run", "tauri", "build", "--", "--bundles", "deb"}},
						{label: "RedHat (.rpm)", command: "bun", args: []string{"run", "tauri", "build", "--", "--bundles", "rpm"}},
					}
				case 4: // Run compiled...
					m.viewingBuilds = true
					m.buildFiles = findBuilds()
					m.buildCursor = 0
				}
			}
		}

	case execFinishedMsg:
		m.executing = false
		if msg.err != nil {
			m.outputCmd = fmt.Sprintf("Error: %v", msg.err)
		} else {
			m.outputCmd = "Command finished successfully."
		}
		// Return to UI after execution
		return m, tea.Quit // Or stay open? User asked to "run executable", so quitting usually makes sense if it took over screen. 
						   // But for 'build', we might want to stay. For now, tea.Exec keeps current process. 
						   // Actually we are using tea.Exec which replaces view.
	
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	}

	return m, nil
}

type execFinishedMsg struct{ err error }

func executeCommand(name string, args ...string) tea.Cmd {
	return tea.ExecProcess(exec.Command(name, args...), func(err error) tea.Msg {
		return execFinishedMsg{err}
	})
}

func findBuilds() []buildFile {
	var files []buildFile
	// Starting from tools/dora-cli, go up two levels to root, then down to target
	root := "../../apps/desktop/src-tauri/target/release/bundle"
	
	filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if !d.IsDir() {
			ext := strings.ToLower(filepath.Ext(path))
			if ext == ".appimage" || ext == ".deb" || ext == ".rpm" {
				info, _ := d.Info()
				files = append(files, buildFile{
					Name:    d.Name(),
					Path:    path,
					ModTime: info.ModTime(),
				})
			}
		}
		return nil
	})

	// Sort by newest first
	sort.Slice(files, func(i, j int) bool {
		return files[i].ModTime.After(files[j].ModTime)
	})

	return files
}
