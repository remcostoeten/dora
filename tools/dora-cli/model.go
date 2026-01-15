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
	Size    int64
	SizeStr string
}

type menuSection int

const (
	sectionMain menuSection = iota
	sectionRunApp
	sectionBuildPlatform
	sectionBuilds
	sectionCheckSizes
	sectionDatabase
	sectionRelease
	sectionAISetup
	sectionPickVersion
	sectionPickModel
)

type model struct {
	mainMenu      []string
	cursor        int
	
	// Navigation state
	currentSection menuSection
	previousSection menuSection

	// Legacy submenu support
	inSubmenu     bool
	subMenu       []subdir
	subMenuTitle  string
	subCursor     int

	// Script selection
	scriptMenu    []scriptDef
	scriptCursor  int
	scriptTitle   string
	pendingScript *scriptDef

	// Option picker (for version/model)
	optionMenu    []string
	optionCursor  int
	optionTitle   string

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
			"[6] Check Build Sizes",
			"[7] Database Management...",
			"─────────────────────────",
			"[8] Release Notes...",
			"[9] AI Setup...",
			"[10] Update/Rebuild Runner",
		},
		spinner: s,
		currentSection: sectionMain,
	}
}

func (m model) Init() tea.Cmd {
	return m.spinner.Tick
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.executing {
			if msg.String() == "ctrl+c" {
				return m, tea.Quit
			}
			return m, nil
		}

		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "up", "k":
			m = m.moveCursorUp()
		case "down", "j":
			m = m.moveCursorDown()
		case "esc", "backspace":
			return m.handleBack()
		case "enter", " ":
			return m.handleSelect()
		}

	case execFinishedMsg:
		m.executing = false
		if msg.err != nil {
			m.outputCmd = fmt.Sprintf("Error: %v", msg.err)
		} else {
			m.outputCmd = "Command finished successfully."
		}
		return m, tea.Quit

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	}

	return m, nil
}

func (m model) moveCursorUp() model {
	switch m.currentSection {
	case sectionMain:
		if m.cursor > 0 {
			m.cursor--
			// Skip separator
			if m.mainMenu[m.cursor] == "─────────────────────────" && m.cursor > 0 {
				m.cursor--
			}
		}
	case sectionRunApp, sectionBuildPlatform:
		if m.subCursor > 0 {
			m.subCursor--
		}
	case sectionBuilds, sectionCheckSizes:
		if m.buildCursor > 0 {
			m.buildCursor--
		}
	case sectionRelease, sectionAISetup:
		if m.scriptCursor > 0 {
			m.scriptCursor--
		}
	case sectionPickVersion, sectionPickModel:
		if m.optionCursor > 0 {
			m.optionCursor--
		}
	}
	return m
}

func (m model) moveCursorDown() model {
	switch m.currentSection {
	case sectionMain:
		if m.cursor < len(m.mainMenu)-1 {
			m.cursor++
			// Skip separator
			if m.mainMenu[m.cursor] == "─────────────────────────" && m.cursor < len(m.mainMenu)-1 {
				m.cursor++
			}
		}
	case sectionRunApp, sectionBuildPlatform:
		if m.subCursor < len(m.subMenu)-1 {
			m.subCursor++
		}
	case sectionBuilds, sectionCheckSizes:
		if m.buildCursor < len(m.buildFiles)-1 {
			m.buildCursor++
		}
	case sectionRelease, sectionAISetup, sectionDatabase:
		if m.scriptCursor < len(m.scriptMenu)-1 {
			m.scriptCursor++
		}
	case sectionPickVersion, sectionPickModel:
		if m.optionCursor < len(m.optionMenu)-1 {
			m.optionCursor++
		}
	}
	return m
}

func (m model) handleBack() (tea.Model, tea.Cmd) {
	switch m.currentSection {
	case sectionMain:
		return m, tea.Quit
	case sectionPickVersion, sectionPickModel:
		m.currentSection = m.previousSection
		m.pendingScript = nil
	default:
		m.currentSection = sectionMain
		m.inSubmenu = false
		m.viewingBuilds = false
	}
	return m, nil
}

func (m model) handleSelect() (tea.Model, tea.Cmd) {
	switch m.currentSection {
	case sectionMain:
		switch m.cursor {
		case 0: // Run all
			return m, executeCommand("bun", "run", "turbo", "dev")
		case 1: // Run app...
			m.currentSection = sectionRunApp
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
			m.currentSection = sectionBuildPlatform
			m.inSubmenu = true
			m.subMenuTitle = "Select Build Platform"
			m.subCursor = 0
			m.subMenu = []subdir{
				{label: "AppImage", command: "bun", args: []string{"run", "tauri", "build", "--", "--bundles", "appimage"}},
				{label: "Debian (.deb)", command: "bun", args: []string{"run", "tauri", "build", "--", "--bundles", "deb"}},
				{label: "RedHat (.rpm)", command: "bun", args: []string{"run", "tauri", "build", "--", "--bundles", "rpm"}},
			}
		case 4: // Run compiled...
			m.currentSection = sectionBuilds
			m.viewingBuilds = true
			m.buildFiles = findBuilds()
			m.buildCursor = 0
		case 5: // Check Build Sizes
			m.currentSection = sectionCheckSizes
			m.buildFiles = findBuilds()
			m.buildCursor = 0
		case 6: // Separator - skip
			return m, nil
		case 7: // Database Management
			m.currentSection = sectionDatabase
			m.scriptTitle = "Database Management"
			m.scriptMenu = dbScripts
			m.scriptCursor = 0
		case 8: // Release Notes...
			m.currentSection = sectionRelease
			m.scriptTitle = "Release Notes"
			m.scriptMenu = releaseScripts
			m.scriptCursor = 0
		case 9: // AI Setup...
			m.currentSection = sectionAISetup
			m.scriptTitle = "AI Setup (Ollama)"
			m.scriptMenu = aiSetupScripts
			m.scriptCursor = 0
		case 10: // Rebuild Runner
			return m, executeCommand("bash", "-c", "if [ -d tools/dora-cli ]; then cd tools/dora-cli; fi; go build -o ../../dora-runner .")
		}

	case sectionRunApp, sectionBuildPlatform:
		choice := m.subMenu[m.subCursor]
		return m, executeCommand(choice.command, choice.args...)

	case sectionBuilds:
		if len(m.buildFiles) > 0 {
			file := m.buildFiles[m.buildCursor]
			return m, executeCommand(file.Path)
		}

	case sectionRelease, sectionAISetup:
		script := m.scriptMenu[m.scriptCursor]
		if script.needsInput {
			m.pendingScript = &script
			m.previousSection = m.currentSection
			if script.inputType == "version" {
				m.currentSection = sectionPickVersion
				m.optionTitle = "Select Version Bump"
				m.optionMenu = versionBumpOptions
				m.optionCursor = 0
			} else if script.inputType == "model" {
				m.currentSection = sectionPickModel
				m.optionTitle = "Select Model"
				m.optionMenu = popularModels
				m.optionCursor = 0
			}
		} else {
			return m, executeCommand(script.command, script.args...)
		}

	case sectionPickVersion:
		if m.pendingScript != nil {
			option := m.optionMenu[m.optionCursor]
			args := append([]string{}, m.pendingScript.args...)
			// Append the selected option to the last arg (--version-bump=)
			args[len(args)-1] = args[len(args)-1] + option
			return m, executeCommand(m.pendingScript.command, args...)
		}

	case sectionPickModel:
		if m.pendingScript != nil {
			option := m.optionMenu[m.optionCursor]
			args := append([]string{}, m.pendingScript.args...)
			args = append(args, option)
			return m, executeCommand(m.pendingScript.command, args...)
		}
	}

	return m, nil
}

type execFinishedMsg struct{ err error }

func executeCommand(name string, args ...string) tea.Cmd {
	return tea.ExecProcess(exec.Command(name, args...), func(err error) tea.Msg {
		return execFinishedMsg{err}
	})
}

func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

func findBuilds() []buildFile {
	var files []buildFile
	
	// Try to resolve the correct path based on CWD
	// 1. From root (production runner)
	pathFromRoot := "apps/desktop/src-tauri/target/release/bundle"
	// 2. From tools/dora-cli (dev mode)
	pathFromDev := "../../apps/desktop/src-tauri/target/release/bundle"
	
	root := pathFromRoot
	if _, err := os.Stat(pathFromRoot); os.IsNotExist(err) {
		if _, err := os.Stat(pathFromDev); err == nil {
			root = pathFromDev
		}
	}
	
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
					Size:    info.Size(),
					SizeStr: formatBytes(info.Size()),
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
