package main

import (
	"fmt"
	"io/fs"
	"os"
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
	sectionInstallBuild // Now "Install Fresh"
	sectionUninstall    // NEW
	sectionReinstall    // NEW (Old Install Build logic)
	sectionCheckSizes
	sectionDatabase
	sectionRelease
	sectionAISetup
	sectionPickVersion
	sectionPickModel
	sectionGitHub
	sectionReleases
)

type model struct {
	mainMenu []string
	cursor   int

	// Navigation state
	currentSection  menuSection
	previousSection menuSection

	// Legacy submenu support
	inSubmenu    bool
	subMenu      []subdir
	subMenuTitle string
	subCursor    int

	// Script selection
	scriptMenu    []scriptDef
	scriptCursor  int
	scriptTitle   string
	pendingScript *scriptDef

	// Option picker (for version/model)
	optionMenu   []string
	optionCursor int
	optionTitle  string

	viewingBuilds bool
	buildFiles    []buildFile
	buildCursor   int

	executing bool
	spinner   spinner.Model
	outputCmd string
	err       error
}

func initialModel() model {
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	return model{
		mainMenu: []string{
			"Run all",
			"Run app...",
			"Build all",
			"Build specific platform...",
			"Run compiled builds...",
			"Install Build (.deb)...",
			"Uninstall Dora...",
			"Reinstall Build (.deb)...",
			"Check Build Sizes",
			"Database Management...",
			"─────────────────────────",
			"Release Notes...",
			"AI Setup...",
			"Update/Rebuild Runner",
			"─────────────────────────",
			"Visit GitHub Repo",
			"Go to Releases",
		},
		spinner:        s,
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
		return m, nil

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
	case sectionBuilds, sectionCheckSizes, sectionInstallBuild, sectionReinstall:
		if m.buildCursor > 0 {
			m.buildCursor--
		}
	case sectionRelease, sectionAISetup, sectionDatabase:
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
	case sectionBuilds, sectionCheckSizes, sectionInstallBuild, sectionReinstall:
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
		// Run app...
		case 1:
			m.currentSection = sectionRunApp
			m.inSubmenu = true
			m.subMenuTitle = "Select App to Run"
			m.subCursor = 0
			// Use the scripts defined in root package.json
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
			// Use desktop:build script from root, or explicit tauri build
			// Note: desktop:build is "bun --cwd apps/desktop run tauri build"
			m.subMenu = []subdir{
				{label: "AppImage", command: "bun", args: []string{"run", "desktop:build", "--", "--bundles", "appimage"}},
				{label: "Debian (.deb)", command: "bun", args: []string{"run", "desktop:build", "--", "--bundles", "deb"}},
				{label: "RedHat (.rpm)", command: "bun", args: []string{"run", "desktop:build", "--", "--bundles", "rpm"}},
			}
		case 4: // Run compiled...
			m.currentSection = sectionBuilds
			m.viewingBuilds = true
			m.buildFiles = findBuilds("exec")
			m.buildCursor = 0
		case 5: // Install Build (Fresh)
			m.currentSection = sectionInstallBuild
			m.viewingBuilds = true
			m.buildFiles = findBuilds("deb")
			m.buildCursor = 0
		case 6: // Uninstall
			// Direct action, but maybe confirm? For TUI simplicity, just run command.
			cmd := "if dpkg -l | grep -q dora; then echo 'Uninstalling...'; sudo DEBIAN_FRONTEND=noninteractive apt-get remove -y dora; else echo 'Dora is not installed.'; fi"
			return m, executeCommand("bash", "-c", cmd)
		case 7: // Reinstall (Uninstall + Install)
			m.currentSection = sectionReinstall
			m.viewingBuilds = true
			m.buildFiles = findBuilds("deb")
			m.buildCursor = 0
		case 8: // Check Build Sizes
			m.currentSection = sectionCheckSizes
			m.buildFiles = findBuilds("all")
			m.buildCursor = 0
		case 9: // Database Management
			m.currentSection = sectionDatabase
			m.scriptTitle = "Database Management"
			m.scriptMenu = dbScripts
			m.scriptCursor = 0
		case 10: // Separator - skip
			return m, nil
		case 11: // Release Notes...
			m.currentSection = sectionRelease
			m.scriptTitle = "Release Notes"
			m.scriptMenu = releaseScripts
			m.scriptCursor = 0
		case 12: // AI Setup...
			m.currentSection = sectionAISetup
			m.scriptTitle = "AI Setup (Ollama)"
			m.scriptMenu = aiSetupScripts
			m.scriptCursor = 0
		case 13: // Rebuild Runner
			rebuildScript := `
if ! command -v go &> /dev/null; then
    echo "Error: Go is not installed or not in PATH."
    echo ""
    echo "To install Go:"
    echo "  - Arch/Manjaro: sudo pacman -S go"
    echo "  - Ubuntu/Debian: sudo apt install golang-go"
    echo "  - macOS: brew install go"
    echo "  - Or visit: https://go.dev/dl/"
    exit 1
fi

if [ -d tools/dora-cli ]; then
    cd tools/dora-cli
fi

echo "Building dora-runner..."
go build -o ../../dora-runner . && echo "Success! Runner updated." || echo "Build failed."
`
			return m, executeCommand("bash", "-c", rebuildScript)
		case 14: // Separator - skip
			return m, nil
		case 15: // GitHub Repo
			// Use xdg-open for Linux, open for Mac.
			// Since we know user is on Linux (deb files), xdg-open is safe bet.
			// Or just "bun open <url>" if we have open package? No, keep it simple.
			return m, executeCommand("xdg-open", "https://github.com/remcostoeten/dora")
		case 16: // Releases
			return m, executeCommand("xdg-open", "https://github.com/remcostoeten/dora/releases")
		}

	case sectionRunApp, sectionBuildPlatform:
		choice := m.subMenu[m.subCursor]
		return m, executeCommand(choice.command, choice.args...)

	case sectionBuilds:
		if len(m.buildFiles) > 0 {
			file := m.buildFiles[m.buildCursor]
			return m, executeCommand(file.Path)
		}

	case sectionInstallBuild:
		if len(m.buildFiles) > 0 {
			file := m.buildFiles[m.buildCursor]
			// Fresh install: Check if installed first to avoid conflict? Or just dpkg -i directly?
			// User asked for "Install" (implying fresh) vs "Uninstall" vs "Reinstall".
			// "Install" usually implies just putting it there. If it's already there, dpkg -i upgrades/replaces it anyway.
			// But user might want to know.
			// I'll assume standard dpkg -i behavior for "Install".
			cmd := fmt.Sprintf("echo 'Refreshing sudo...'; sudo -v; echo 'Installing %s...'; sudo DEBIAN_FRONTEND=noninteractive dpkg -i %s", file.Name, file.Path)
			return m, executeCommand("bash", "-c", cmd)
		}

	case sectionReinstall:
		if len(m.buildFiles) > 0 {
			file := m.buildFiles[m.buildCursor]
			// Full nuke and pave
			cmd := fmt.Sprintf("echo 'Refreshing sudo...'; sudo -v; echo 'Uninstalling...'; sudo DEBIAN_FRONTEND=noninteractive apt-get remove -y dora || true; echo 'Installing new version...'; sudo DEBIAN_FRONTEND=noninteractive dpkg -i %s", file.Path)
			return m, executeCommand("bash", "-c", cmd)
		}
		if len(m.buildFiles) > 0 {
			file := m.buildFiles[m.buildCursor]
			// Uninstall old 'dora' and install new .deb
			// Requires sudo
			cmd := fmt.Sprintf("echo 'Refreshing sudo credentials...'; sudo -v; echo 'Uninstalling old Dora...'; sudo DEBIAN_FRONTEND=noninteractive apt-get remove -y dora || true; echo 'Installing new version...'; sudo DEBIAN_FRONTEND=noninteractive dpkg -i %s", file.Path)
			return m, executeCommand("bash", "-c", cmd)
		}

	case sectionRelease, sectionAISetup, sectionDatabase:
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
	// Find project root by looking for package.json
	// This ensures we always run commands from the root, regardless of where the binary is
	rootDir, err := os.Getwd()
	if err == nil {
		for {
			if _, err := os.Stat(filepath.Join(rootDir, "package.json")); err == nil {
				break
			}
			parent := filepath.Dir(rootDir)
			if parent == rootDir {
				// Hit root of filesystem, fallback to original CWD or hardcoded assumption
				// But let's check one specific typical case: tools/dora-cli -> ../../
				if strings.HasSuffix(rootDir, "tools/dora-cli") {
					rootDir = filepath.Join(rootDir, "../..")
				}
				break
			}
			rootDir = parent
		}
	}

	// Wrap command in bash to ensure we pause in the foreground terminal
	// And explicitely CD to rootDir before running
	var commandStr string
	if name == "bun" || name == "go" || name == "git" {
		commandStr = fmt.Sprintf("cd %s && %s %s", rootDir, name, strings.Join(args, " "))
	} else {
		// For absolute paths (like running a build artifact), don't change dir or let it handle it
		commandStr = fmt.Sprintf("%s %s", name, strings.Join(args, " "))
	}

	wrapperArgs := []string{"-c", fmt.Sprintf(`echo "Working Directory: %s"; %s; echo; read -rs -p "Press Enter to return to menu..."`, rootDir, commandStr)}

	return tea.ExecProcess(exec.Command("bash", wrapperArgs...), func(err error) tea.Msg {
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

func findBuilds(mode string) []buildFile {
	var files []buildFile

	// ... (path resolution same as before)
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
			isValid := false

			if mode == "exec" {
				if ext == ".appimage" {
					isValid = true
				}
			} else if mode == "deb" {
				if ext == ".deb" {
					isValid = true
				}
			} else { // "all"
				if ext == ".appimage" || ext == ".deb" || ext == ".rpm" {
					isValid = true
				}
			}

			if isValid {
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

	// ... sort ...
	sort.Slice(files, func(i, j int) bool {
		return files[i].ModTime.After(files[j].ModTime)
	})

	return files
}
