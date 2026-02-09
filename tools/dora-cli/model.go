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

// isSectionHeader checks if a menu item is a non-selectable section header.
func isSectionHeader(item string) bool {
	return strings.HasPrefix(item, "──")
}

type model struct {
	mainMenu []string
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
		mainMenu: []string{
			//                                     Index
			"── Development ──────────────────", // 0  header
			"Run Web Dev (Vite only)",           // 1
			"Run Desktop Dev (Tauri)",           // 2
			"Run All (Turbo)",                   // 3
			"── Build ────────────────────────", // 4  header
			"Build All Platforms",               // 5
			"Build Linux...",                    // 6
			"Build Windows...",                  // 7
			"Build macOS...",                    // 8
			"── Manage ───────────────────────", // 9  header
			"Run Compiled Build...",             // 10
			"Install Build (.deb)...",           // 11
			"Uninstall Dora",                    // 12
			"Reinstall Build (.deb)...",         // 13
			"Check Build Sizes",                 // 14
			"── Tools ────────────────────────", // 15 header
			"Database Management...",            // 16
			"Release Notes...",                  // 17
			"AI Setup...",                       // 18
			"Update/Rebuild CLI",                // 19
			"── Links ────────────────────────", // 20 header
			"Visit GitHub Repo",                 // 21
			"Go to Releases",                    // 22
		},
		cursor:         1, // Start at first actionable item
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
		prev := m.cursor
		if m.cursor > 0 {
			m.cursor--
			for m.cursor > 0 && isSectionHeader(m.mainMenu[m.cursor]) {
				m.cursor--
			}
			if isSectionHeader(m.mainMenu[m.cursor]) {
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
			for m.cursor < len(m.mainMenu)-1 && isSectionHeader(m.mainMenu[m.cursor]) {
				m.cursor++
			}
			if isSectionHeader(m.mainMenu[m.cursor]) {
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

func (m model) handleSelect() (tea.Model, tea.Cmd) {
	switch m.currentSection {
	case sectionMain:
		if isSectionHeader(m.mainMenu[m.cursor]) {
			return m, nil
		}

		switch m.cursor {
		case 1: // Run Web Dev (Vite only)
			return m, executeCommand("bun", "run", "web:dev")
		case 2: // Run Desktop Dev (Tauri)
			return m, executeCommand("bun", "run", "desktop:dev")
		case 3: // Run All (Turbo)
			return m, executeCommand("bun", "run", "dev")

		case 5: // Build All Platforms
			return m, executeCommand("bun", "run", "desktop:build")
		case 6: // Build Linux...
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
		case 7: // Build Windows...
			m.currentSection = sectionBuildWindows
			m.inSubmenu = true
			m.subMenuTitle = "Build Windows Target"
			m.subCursor = 0
			m.subMenu = []subdir{
				{label: "NSIS Installer (.exe)", command: "bun", args: []string{"run", "desktop:build:nsis"}},
				{label: "MSI Installer (.msi)", command: "bun", args: []string{"run", "desktop:build:msi"}},
				{label: "All Windows targets", command: "bun", args: []string{"run", "desktop:build:win"}},
			}
		case 8: // Build macOS...
			m.currentSection = sectionBuildMac
			m.inSubmenu = true
			m.subMenuTitle = "Build macOS Target"
			m.subCursor = 0
			m.subMenu = []subdir{
				{label: "DMG (.dmg)", command: "bun", args: []string{"run", "desktop:build:dmg"}},
			}

		case 10: // Run Compiled Build...
			m.currentSection = sectionBuilds
			m.viewingBuilds = true
			m.buildFiles = findBuilds("exec")
			m.buildCursor = 0
		case 11: // Install Build (.deb)...
			m.currentSection = sectionInstallBuild
			m.viewingBuilds = true
			m.buildFiles = findBuilds("deb")
			m.buildCursor = 0
		case 12: // Uninstall Dora
			switch runtime.GOOS {
			case "linux":
				cmd := `if dpkg -l | grep -q dora; then echo 'Uninstalling...'; sudo DEBIAN_FRONTEND=noninteractive apt-get remove -y dora; else echo 'Dora is not installed.'; fi`
				return m, executeCommand("bash", "-c", cmd)
			case "darwin":
				cmd := `if [ -d "/Applications/Dora.app" ]; then echo 'Removing Dora.app...'; rm -rf "/Applications/Dora.app"; echo 'Done.'; else echo 'Dora is not installed in /Applications.'; fi`
				return m, executeCommand("bash", "-c", cmd)
			default:
				return m, executeCommand("bash", "-c", "echo 'Uninstall not supported on this platform. Remove Dora manually.'")
			}
		case 13: // Reinstall Build (.deb)...
			m.currentSection = sectionReinstall
			m.viewingBuilds = true
			m.buildFiles = findBuilds("deb")
			m.buildCursor = 0
		case 14: // Check Build Sizes
			m.currentSection = sectionCheckSizes
			m.buildFiles = findBuilds("all")
			m.buildCursor = 0

		case 16: // Database Management
			m.currentSection = sectionDatabase
			m.scriptTitle = "Database Management"
			m.scriptMenu = dbScripts
			m.scriptCursor = 0
		case 17: // Release Notes...
			m.currentSection = sectionRelease
			m.scriptTitle = "Release Notes"
			m.scriptMenu = releaseScripts
			m.scriptCursor = 0
		case 18: // AI Setup...
			m.currentSection = sectionAISetup
			m.scriptTitle = "AI Setup (Ollama)"
			m.scriptMenu = aiSetupScripts
			m.scriptCursor = 0
		case 19: // Update/Rebuild CLI
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

		case 21: // Visit GitHub Repo
			return m, openURL("https://github.com/remcostoeten/dora")
		case 22: // Go to Releases
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
			cmd := fmt.Sprintf("echo 'Refreshing sudo...'; sudo -v; echo 'Installing %s...'; sudo DEBIAN_FRONTEND=noninteractive dpkg -i %s", file.Name, file.Path)
			return m, executeCommand("bash", "-c", cmd)
		}

	case sectionReinstall:
		if len(m.buildFiles) > 0 {
			file := m.buildFiles[m.buildCursor]
			cmd := fmt.Sprintf("echo 'Refreshing sudo...'; sudo -v; echo 'Uninstalling old version...'; sudo DEBIAN_FRONTEND=noninteractive apt-get remove -y dora || true; echo 'Installing %s...'; sudo DEBIAN_FRONTEND=noninteractive dpkg -i %s", file.Name, file.Path)
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

func executeCommand(name string, args ...string) tea.Cmd {
	rootDir := findProjectRoot()

	var commandStr string
	if filepath.IsAbs(name) {
		// Absolute path (e.g. running a build artifact) — don't change dir
		commandStr = fmt.Sprintf("%s %s", name, strings.Join(args, " "))
	} else {
		commandStr = fmt.Sprintf("cd %s && %s %s", rootDir, name, strings.Join(args, " "))
	}

	wrapperArgs := []string{"-c", fmt.Sprintf(`echo "Working Directory: %s"; %s; echo; read -rs -p "Press Enter to return to menu..."`, rootDir, commandStr)}

	return tea.ExecProcess(exec.Command("bash", wrapperArgs...), func(err error) tea.Msg {
		return execFinishedMsg{err}
	})
}

// openURL opens a URL in the default browser, cross-platform.
func openURL(url string) tea.Cmd {
	var opener string
	switch runtime.GOOS {
	case "darwin":
		opener = "open"
	case "windows":
		opener = "start"
	default:
		opener = "xdg-open"
	}
	return executeCommand(opener, url)
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
			isValid = ext == ".appimage"
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
				return nil // skip this file
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
