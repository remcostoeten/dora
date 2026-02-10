package main

import (
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// ---------------------------------------------------------------------------
// Data-driven main menu
// ---------------------------------------------------------------------------

// menuAction identifies what a menu item does when selected.
type menuAction int

const (
	actionNone menuAction = iota
	actionWebDev
	actionDesktopDev
	actionRunAll
	actionBuildAll
	actionBuildLinux
	actionBuildWindows
	actionBuildMac
	actionRunBuild
	actionInstallDeb
	actionUninstall
	actionReinstallDeb
	actionCheckSizes
	actionDatabase
	actionRelease
	actionAISetup
	actionRebuildCLI
	actionGitHubRepo
	actionReleases
)

// menuItem represents a single entry in the main menu.
type menuItem struct {
	label    string
	action   menuAction
	isHeader bool
}

func hdr(label string) menuItem  { return menuItem{label: label, isHeader: true} }
func act(label string, a menuAction) menuItem { return menuItem{label: label, action: a} }

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

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
	sectionBuildLinux
	sectionBuildWindows
	sectionBuildMac
	sectionBuilds
	sectionInstallBuild
	sectionReinstall
	sectionCheckSizes
	sectionDatabase
	sectionRelease
	sectionAISetup
	sectionPickVersion
	sectionPickModel
)

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

type model struct {
	mainMenu []menuItem
	cursor   int

	currentSection  menuSection
	previousSection menuSection

	inSubmenu    bool
	subMenu      []subdir
	subMenuTitle string
	subCursor    int

	scriptMenu    []scriptDef
	scriptCursor  int
	scriptTitle   string
	pendingScript *scriptDef

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
		mainMenu: []menuItem{
			hdr("── Development ──────────────────"),
			act("Run Web Dev (Vite only)", actionWebDev),
			act("Run Desktop Dev (Tauri)", actionDesktopDev),
			act("Run All (Turbo)", actionRunAll),
			hdr("── Build ────────────────────────"),
			act("Build All Platforms", actionBuildAll),
			act("Build Linux...", actionBuildLinux),
			act("Build Windows...", actionBuildWindows),
			act("Build macOS...", actionBuildMac),
			hdr("── Manage ───────────────────────"),
			act("Run Compiled Build...", actionRunBuild),
			act("Install Build (.deb)...", actionInstallDeb),
			act("Uninstall Dora", actionUninstall),
			act("Reinstall Build (.deb)...", actionReinstallDeb),
			act("Check Build Sizes", actionCheckSizes),
			hdr("── Tools ────────────────────────"),
			act("Database Management...", actionDatabase),
			act("Release Notes...", actionRelease),
			act("AI Setup...", actionAISetup),
			act("Update/Rebuild CLI", actionRebuildCLI),
			hdr("── Links ────────────────────────"),
			act("Visit GitHub Repo", actionGitHubRepo),
			act("Go to Releases", actionReleases),
		},
		cursor:         1, // First actionable item
		spinner:        s,
		currentSection: sectionMain,
	}
}

func (m model) Init() tea.Cmd {
	return m.spinner.Tick
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Cursor movement
// ---------------------------------------------------------------------------

func (m model) moveCursorUp() model {
	switch m.currentSection {
	case sectionMain:
		prev := m.cursor
		if m.cursor > 0 {
			m.cursor--
			for m.cursor > 0 && m.mainMenu[m.cursor].isHeader {
				m.cursor--
			}
			if m.mainMenu[m.cursor].isHeader {
				m.cursor = prev
			}
		}
	case sectionBuildLinux, sectionBuildWindows, sectionBuildMac:
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
		prev := m.cursor
		if m.cursor < len(m.mainMenu)-1 {
			m.cursor++
			for m.cursor < len(m.mainMenu)-1 && m.mainMenu[m.cursor].isHeader {
				m.cursor++
			}
			if m.mainMenu[m.cursor].isHeader {
				m.cursor = prev
			}
		}
	case sectionBuildLinux, sectionBuildWindows, sectionBuildMac:
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

// ---------------------------------------------------------------------------
// Selection handling (dispatches on menuAction, not index)
// ---------------------------------------------------------------------------

func (m model) handleSelect() (tea.Model, tea.Cmd) {
	switch m.currentSection {
	case sectionMain:
		selected := m.mainMenu[m.cursor]
		if selected.isHeader {
			return m, nil
		}

		switch selected.action {
		case actionWebDev:
			return m, executeCommand("bun", "run", "web:dev")
		case actionDesktopDev:
			return m, executeCommand("bun", "run", "desktop:dev")
		case actionRunAll:
			return m, executeCommand("bun", "run", "dev")

		case actionBuildAll:
			return m, executeCommand("bun", "run", "desktop:build")
		case actionBuildLinux:
			m.currentSection = sectionBuildLinux
			m.inSubmenu = true
			m.subMenuTitle = "Build Linux Target"
			m.subCursor = 0
			m.subMenu = []subdir{
				{label: "AppImage (.appimage)", command: "bun", args: []string{"run", "desktop:build:appimage"}},
				{label: "Debian (.deb)", command: "bun", args: []string{"run", "desktop:build:deb"}},
				{label: "RPM (.rpm)", command: "bun", args: []string{"run", "desktop:build:rpm"}},
				{label: "All Linux targets", command: "bun", args: []string{"run", "desktop:build:linux"}},
			}
		case actionBuildWindows:
			m.currentSection = sectionBuildWindows
			m.inSubmenu = true
			m.subMenuTitle = "Build Windows Target"
			m.subCursor = 0
			m.subMenu = []subdir{
				{label: "NSIS Installer (.exe)", command: "bun", args: []string{"run", "desktop:build:nsis"}},
				{label: "MSI Installer (.msi)", command: "bun", args: []string{"run", "desktop:build:msi"}},
				{label: "All Windows targets", command: "bun", args: []string{"run", "desktop:build:win"}},
			}
		case actionBuildMac:
			m.currentSection = sectionBuildMac
			m.inSubmenu = true
			m.subMenuTitle = "Build macOS Target"
			m.subCursor = 0
			m.subMenu = []subdir{
				{label: "DMG (.dmg)", command: "bun", args: []string{"run", "desktop:build:dmg"}},
			}

		case actionRunBuild:
			m.currentSection = sectionBuilds
			m.viewingBuilds = true
			m.buildFiles = findBuilds("exec")
			m.buildCursor = 0
		case actionInstallDeb:
			m.currentSection = sectionInstallBuild
			m.viewingBuilds = true
			m.buildFiles = findBuilds("deb")
			m.buildCursor = 0
		case actionUninstall:
			switch runtime.GOOS {
			case "linux":
				return m, runShellScript(`if dpkg -l | grep -q dora; then echo 'Uninstalling...'; sudo DEBIAN_FRONTEND=noninteractive apt-get remove -y dora; else echo 'Dora is not installed.'; fi`)
			case "darwin":
				return m, runShellScript(`if [ -d "/Applications/Dora.app" ]; then echo 'Removing Dora.app...'; rm -rf "/Applications/Dora.app"; echo 'Done.'; else echo 'Dora is not installed in /Applications.'; fi`)
			case "windows":
				return m, runShellScript(`echo To uninstall Dora, open Windows Settings, go to Apps, search for "Dora" and click Uninstall.`)
			}
		case actionReinstallDeb:
			m.currentSection = sectionReinstall
			m.viewingBuilds = true
			m.buildFiles = findBuilds("deb")
			m.buildCursor = 0
		case actionCheckSizes:
			m.currentSection = sectionCheckSizes
			m.buildFiles = findBuilds("all")
			m.buildCursor = 0

		case actionDatabase:
			m.currentSection = sectionDatabase
			m.scriptTitle = "Database Management"
			m.scriptMenu = dbScripts
			m.scriptCursor = 0
		case actionRelease:
			m.currentSection = sectionRelease
			m.scriptTitle = "Release Notes"
			m.scriptMenu = releaseScripts
			m.scriptCursor = 0
		case actionAISetup:
			m.currentSection = sectionAISetup
			m.scriptTitle = "AI Setup (Ollama)"
			m.scriptMenu = aiSetupScripts
			m.scriptCursor = 0
		case actionRebuildCLI:
			if runtime.GOOS == "windows" {
				return m, runShellScript(`where go >nul 2>nul && (echo Building dora-runner... & cd tools\dora-cli & go build -o ..\..\dora-runner.exe . && echo Success! Runner updated. || echo Build failed.) || (echo Error: Go is not installed. Visit https://go.dev/dl/ to install.)`)
			}
			return m, runShellScript(`
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
`)

		case actionGitHubRepo:
			return m, openURL("https://github.com/remcostoeten/dora")
		case actionReleases:
			return m, openURL("https://github.com/remcostoeten/dora/releases")
		}

	case sectionBuildLinux, sectionBuildWindows, sectionBuildMac:
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
			cmd := fmt.Sprintf("echo 'Refreshing sudo...'; sudo -v; echo 'Installing %s...'; sudo DEBIAN_FRONTEND=noninteractive dpkg -i %q", file.Name, file.Path)
			return m, runShellScript(cmd)
		}

	case sectionReinstall:
		if len(m.buildFiles) > 0 {
			file := m.buildFiles[m.buildCursor]
			cmd := fmt.Sprintf("echo 'Refreshing sudo...'; sudo -v; echo 'Uninstalling old version...'; sudo DEBIAN_FRONTEND=noninteractive apt-get remove -y dora || true; echo 'Installing %s...'; sudo DEBIAN_FRONTEND=noninteractive dpkg -i %q", file.Name, file.Path)
			return m, runShellScript(cmd)
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
		if m.pendingScript != nil && len(m.pendingScript.args) > 0 {
			option := m.optionMenu[m.optionCursor]
			args := append([]string{}, m.pendingScript.args...)
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

// ---------------------------------------------------------------------------
// Command execution — platform-aware
// ---------------------------------------------------------------------------

type execFinishedMsg struct{ err error }

// findProjectRoot walks up the directory tree to find the project root (contains package.json).
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

// executeCommand runs an executable with args, wrapping in the platform-appropriate shell.
func executeCommand(name string, args ...string) tea.Cmd {
	rootDir := findProjectRoot()

	if runtime.GOOS == "windows" {
		var commandStr string
		if filepath.IsAbs(name) {
			commandStr = fmt.Sprintf(`"%s" %s`, name, strings.Join(args, " "))
		} else {
			commandStr = fmt.Sprintf(`cd /d "%s" && %s %s`, rootDir, name, strings.Join(args, " "))
		}
		wrapped := fmt.Sprintf(`echo Working Directory: %s & %s & echo. & pause`, rootDir, commandStr)
		return tea.ExecProcess(exec.Command("cmd", "/c", wrapped), func(err error) tea.Msg {
			return execFinishedMsg{err}
		})
	}

	// Unix (Linux, macOS)
	var commandStr string
	if filepath.IsAbs(name) {
		commandStr = fmt.Sprintf("%s %s", name, strings.Join(args, " "))
	} else {
		commandStr = fmt.Sprintf("cd %s && %s %s", rootDir, name, strings.Join(args, " "))
	}
	wrapped := fmt.Sprintf(`echo "Working Directory: %s"; %s; echo; read -rs -p "Press Enter to return to menu..."`, rootDir, commandStr)
	return tea.ExecProcess(exec.Command("bash", "-c", wrapped), func(err error) tea.Msg {
		return execFinishedMsg{err}
	})
}

// runShellScript runs an inline shell script using the platform's native shell.
// Use this instead of executeCommand("bash", "-c", ...) for cross-platform support.
func runShellScript(script string) tea.Cmd {
	rootDir := findProjectRoot()

	if runtime.GOOS == "windows" {
		wrapped := fmt.Sprintf(`cd /d "%s" & %s & echo. & pause`, rootDir, script)
		return tea.ExecProcess(exec.Command("cmd", "/c", wrapped), func(err error) tea.Msg {
			return execFinishedMsg{err}
		})
	}

	wrapped := fmt.Sprintf(`cd "%s"; %s; echo; read -rs -p "Press Enter to return to menu..."`, rootDir, script)
	return tea.ExecProcess(exec.Command("bash", "-c", wrapped), func(err error) tea.Msg {
		return execFinishedMsg{err}
	})
}

// openURL opens a URL in the default browser, cross-platform.
func openURL(url string) tea.Cmd {
	switch runtime.GOOS {
	case "windows":
		// "start" is a cmd.exe builtin — must invoke via cmd /c directly.
		return tea.ExecProcess(exec.Command("cmd", "/c", fmt.Sprintf(`start "" "%s"`, url)), func(err error) tea.Msg {
			return execFinishedMsg{err}
		})
	case "darwin":
		return executeCommand("open", url)
	default:
		return executeCommand("xdg-open", url)
	}
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

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

	root := filepath.Join(findProjectRoot(), "apps", "desktop", "src-tauri", "target", "release", "bundle")

	filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		isValid := false

		switch mode {
		case "exec":
			switch runtime.GOOS {
			case "linux":
				isValid = ext == ".appimage"
			case "darwin":
				isValid = ext == ".dmg"
			case "windows":
				isValid = ext == ".exe" || ext == ".msi"
			default:
				isValid = ext == ".appimage"
			}
		case "deb":
			isValid = ext == ".deb"
		case "rpm":
			isValid = ext == ".rpm"
		default: // "all"
			isValid = ext == ".appimage" || ext == ".deb" || ext == ".rpm" ||
				ext == ".dmg" || ext == ".exe" || ext == ".msi"
		}

		if isValid {
			info, err := d.Info()
			if err != nil {
				return nil
			}
			files = append(files, buildFile{
				Name:    d.Name(),
				Path:    path,
				ModTime: info.ModTime(),
				Size:    info.Size(),
				SizeStr: formatBytes(info.Size()),
			})
		}
		return nil
	})

	sort.Slice(files, func(i, j int) bool {
		return files[i].ModTime.After(files[j].ModTime)
	})

	return files
}
