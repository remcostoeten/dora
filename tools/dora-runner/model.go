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
// Types
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
	// Run
	sectionRunApp
	// Build
	sectionBuildPlatform
	sectionBuilds
	// Install / uninstall
	sectionInstallBuild
	sectionReinstall
	// Sizes
	sectionCheckSizes
	// Script-driven sections
	sectionDatabase
	sectionReleaseNotes
	sectionReleasePackaging
	sectionTests
	sectionLinting
	sectionSEO
	sectionAISetup
	sectionDevTools
	// VM
	sectionVM
	// CI dispatch
	sectionCI
	// Pickers
	sectionPickVersion
	sectionPickModel
)

type model struct {
	mainMenu []string
	cursor   int

	currentSection  menuSection
	previousSection menuSection

	// Submenus (run / build / vm)
	inSubmenu    bool
	subMenu      []subdir
	subMenuTitle string
	subCursor    int

	// Script menus
	scriptMenu   []scriptDef
	scriptCursor int
	scriptTitle  string
	pendingScript *scriptDef

	// Option pickers
	optionMenu   []string
	optionCursor int
	optionTitle  string

	// Build file browser
	viewingBuilds bool
	buildFiles    []buildFile
	buildCursor   int

	// CI dispatch
	ciMenu   []ciWorkflow
	ciCursor int

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
			"─────────────────────────",
			"Build all",
			"Build specific platform...",
			"Run compiled builds...",
			"─────────────────────────",
			"Install Build (.deb)...",
			"Reinstall Build (.deb)...",
			"Uninstall Dora",
			"Check Build Sizes",
			"─────────────────────────",
			"Database Management...",
			"─────────────────────────",
			"Tests...",
			"Lint & Format...",
			"Marketing SEO...",
			"─────────────────────────",
			"Release Notes...",
			"Release Packaging...",
			"─────────────────────────",
			"AI Setup...",
			"Dev Tools...",
			"─────────────────────────",
			"Update/Rebuild Runner",
			"VM Testing...",
			"CI Dispatch...",
			"─────────────────────────",
			"Visit GitHub Repo",
			"Go to Releases",
		},
		spinner:        s,
		currentSection: sectionMain,
	}
}

// ---------------------------------------------------------------------------
// Bubbletea interface
// ---------------------------------------------------------------------------

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
			m.outputCmd = "Done."
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
// Navigation helpers
// ---------------------------------------------------------------------------

func isSeparator(s string) bool {
	return strings.HasPrefix(s, "─")
}

func (m model) moveCursorUp() model {
	switch m.currentSection {
	case sectionMain:
		for m.cursor > 0 {
			m.cursor--
			if !isSeparator(m.mainMenu[m.cursor]) {
				break
			}
		}
	case sectionRunApp, sectionBuildPlatform, sectionVM:
		if m.subCursor > 0 {
			m.subCursor--
		}
	case sectionBuilds, sectionCheckSizes, sectionInstallBuild, sectionReinstall:
		if m.buildCursor > 0 {
			m.buildCursor--
		}
	case sectionDatabase, sectionReleaseNotes, sectionReleasePackaging,
		sectionTests, sectionLinting, sectionSEO, sectionAISetup, sectionDevTools:
		if m.scriptCursor > 0 {
			m.scriptCursor--
		}
	case sectionCI:
		if m.ciCursor > 0 {
			m.ciCursor--
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
		for m.cursor < len(m.mainMenu)-1 {
			m.cursor++
			if !isSeparator(m.mainMenu[m.cursor]) {
				break
			}
		}
	case sectionRunApp, sectionBuildPlatform, sectionVM:
		if m.subCursor < len(m.subMenu)-1 {
			m.subCursor++
		}
	case sectionBuilds, sectionCheckSizes, sectionInstallBuild, sectionReinstall:
		if m.buildCursor < len(m.buildFiles)-1 {
			m.buildCursor++
		}
	case sectionDatabase, sectionReleaseNotes, sectionReleasePackaging,
		sectionTests, sectionLinting, sectionSEO, sectionAISetup, sectionDevTools:
		if m.scriptCursor < len(m.scriptMenu)-1 {
			m.scriptCursor++
		}
	case sectionCI:
		if m.ciCursor < len(m.ciMenu)-1 {
			m.ciCursor++
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
// Selection handler
// ---------------------------------------------------------------------------

func (m model) handleSelect() (tea.Model, tea.Cmd) {
	switch m.currentSection {

	// ------------------------------------------------------------------
	case sectionMain:
		label := m.mainMenu[m.cursor]
		if isSeparator(label) {
			return m, nil
		}

		switch label {
		case "Run all":
			return m, executeCommand("bun", "run", "turbo", "dev")

		case "Run app...":
			m.currentSection = sectionRunApp
			m.inSubmenu = true
			m.subMenuTitle = "Select App to Run"
			m.subCursor = 0
			m.subMenu = []subdir{
				{label: "Desktop (Tauri)", command: "bun", args: []string{"run", "desktop:dev"}},
				{label: "Web (mock mode)", command: "bun", args: []string{"run", "web:dev"}},
				{label: "Marketing (Next.js)", command: "bun", args: []string{"--cwd", "apps/marketing", "run", "dev"}},
				{label: "DB Tester", command: "bun", args: []string{"--cwd", "apps/db-tester", "run", "dev"}},
				{label: "All (turbo)", command: "bun", args: []string{"run", "turbo", "dev"}},
			}

		case "Build all":
			return m, executeCommand("bun", "run", "turbo", "build")

		case "Build specific platform...":
			m.currentSection = sectionBuildPlatform
			m.inSubmenu = true
			m.subMenuTitle = "Select Build Target"
			m.subCursor = 0
			m.subMenu = []subdir{
				// Linux bundles
				{label: "Linux — all bundles", command: "bun", args: []string{"run", "desktop:build:linux"}},
				{label: "Linux — AppImage", command: "bun", args: []string{"run", "desktop:build:appimage"}},
				{label: "Linux — Debian (.deb)", command: "bun", args: []string{"run", "desktop:build:deb"}},
				{label: "Linux — RPM (.rpm)", command: "bun", args: []string{"run", "desktop:build:rpm"}},
				// Windows bundles
				{label: "Windows — all bundles", command: "bun", args: []string{"run", "desktop:build:win"}},
				{label: "Windows — NSIS (.exe)", command: "bun", args: []string{"run", "desktop:build:nsis"}},
				{label: "Windows — MSI (.msi)", command: "bun", args: []string{"run", "desktop:build:msi"}},
				// macOS
				{label: "macOS — DMG", command: "bun", args: []string{"run", "desktop:build:mac"}},
			}

		case "Run compiled builds...":
			m.currentSection = sectionBuilds
			m.viewingBuilds = true
			m.buildFiles = findBuilds("exec")
			m.buildCursor = 0

		case "Install Build (.deb)...":
			m.currentSection = sectionInstallBuild
			m.viewingBuilds = true
			m.buildFiles = findBuilds("deb")
			m.buildCursor = 0

		case "Reinstall Build (.deb)...":
			m.currentSection = sectionReinstall
			m.viewingBuilds = true
			m.buildFiles = findBuilds("deb")
			m.buildCursor = 0

		case "Uninstall Dora":
			if runtime.GOOS == "windows" {
				return m, runShellScript("echo Uninstall via Settings > Apps > Installed apps.")
			}
			script := "if dpkg -l | grep -q dora; then echo 'Uninstalling...'; sudo DEBIAN_FRONTEND=noninteractive apt-get remove -y dora; else echo 'Dora is not installed.'; fi"
			return m, runShellScript(script)

		case "Check Build Sizes":
			m.currentSection = sectionCheckSizes
			m.buildFiles = findBuilds("all")
			m.buildCursor = 0

		case "Database Management...":
			m.currentSection = sectionDatabase
			m.scriptTitle = "Database Management"
			m.scriptMenu = dbScripts
			m.scriptCursor = 0

		case "Tests...":
			m.currentSection = sectionTests
			m.scriptTitle = "Tests"
			m.scriptMenu = testScripts
			m.scriptCursor = 0

		case "Lint & Format...":
			m.currentSection = sectionLinting
			m.scriptTitle = "Lint & Format"
			m.scriptMenu = lintScripts
			m.scriptCursor = 0

		case "Marketing SEO...":
			m.currentSection = sectionSEO
			m.scriptTitle = "Marketing SEO"
			m.scriptMenu = seoScripts
			m.scriptCursor = 0

		case "Release Notes...":
			m.currentSection = sectionReleaseNotes
			m.scriptTitle = "Release Notes"
			m.scriptMenu = releaseNotesScripts
			m.scriptCursor = 0

		case "Release Packaging...":
			m.currentSection = sectionReleasePackaging
			m.scriptTitle = "Release Packaging"
			m.scriptMenu = releasePackagingScripts
			m.scriptCursor = 0

		case "AI Setup...":
			m.currentSection = sectionAISetup
			m.scriptTitle = "AI Setup (Ollama)"
			m.scriptMenu = aiSetupScripts
			m.scriptCursor = 0

		case "Dev Tools...":
			m.currentSection = sectionDevTools
			m.scriptTitle = "Dev Tools & Diagnostics"
			m.scriptMenu = devToolScripts
			m.scriptCursor = 0

		case "Update/Rebuild Runner":
			return m, runShellScript(rebuildRunnerScript())

		case "VM Testing...":
			m.currentSection = sectionVM
			m.inSubmenu = true
			m.subMenuTitle = "VM Testing (KVM/libvirt)"
			m.subCursor = 0
			self := os.Args[0]
			m.subMenu = []subdir{
				{label: "VM Init", command: self, args: []string{"vm", "init"}},
				{label: "VM Ensure", command: self, args: []string{"vm", "ensure"}},
				{label: "VM Run", command: self, args: []string{"vm", "run"}},
				{label: "VM Logs", command: self, args: []string{"vm", "logs"}},
				{label: "VM Clean", command: self, args: []string{"vm", "clean"}},
				{label: "VM Nuke", command: self, args: []string{"vm", "nuke"}},
			}

		case "CI Dispatch...":
			m.currentSection = sectionCI
			m.ciMenu = ciWorkflows
			m.ciCursor = 0

		case "Visit GitHub Repo":
			return m, openURL("https://github.com/remcostoeten/dora")

		case "Go to Releases":
			return m, openURL("https://github.com/remcostoeten/dora/releases")
		}

	// ------------------------------------------------------------------
	case sectionRunApp, sectionBuildPlatform, sectionVM:
		choice := m.subMenu[m.subCursor]
		return m, executeCommand(choice.command, choice.args...)

	// ------------------------------------------------------------------
	case sectionBuilds:
		if len(m.buildFiles) > 0 {
			return m, executeCommand(m.buildFiles[m.buildCursor].Path)
		}

	// ------------------------------------------------------------------
	case sectionInstallBuild:
		if len(m.buildFiles) > 0 {
			f := m.buildFiles[m.buildCursor]
			script := fmt.Sprintf("sudo -v && sudo DEBIAN_FRONTEND=noninteractive dpkg -i %s", f.Path)
			return m, runShellScript(script)
		}

	// ------------------------------------------------------------------
	case sectionReinstall:
		if len(m.buildFiles) > 0 {
			f := m.buildFiles[m.buildCursor]
			script := fmt.Sprintf(
				"sudo -v && sudo DEBIAN_FRONTEND=noninteractive apt-get remove -y dora || true && sudo DEBIAN_FRONTEND=noninteractive dpkg -i %s",
				f.Path,
			)
			return m, runShellScript(script)
		}

	// ------------------------------------------------------------------
	case sectionDatabase, sectionReleaseNotes, sectionReleasePackaging,
		sectionTests, sectionLinting, sectionSEO, sectionAISetup, sectionDevTools:
		script := m.scriptMenu[m.scriptCursor]
		if script.needsInput {
			m.pendingScript = &script
			m.previousSection = m.currentSection
			switch script.inputType {
			case "version":
				m.currentSection = sectionPickVersion
				m.optionTitle = "Select Version Bump"
				m.optionMenu = versionBumpOptions
				m.optionCursor = 0
			case "model":
				m.currentSection = sectionPickModel
				m.optionTitle = "Select Model"
				m.optionMenu = popularModels
				m.optionCursor = 0
			}
		} else {
			return m, executeCommand(script.command, script.args...)
		}

	// ------------------------------------------------------------------
	case sectionCI:
		if len(m.ciMenu) > 0 {
			wf := m.ciMenu[m.ciCursor]
			self := os.Args[0]
			return m, executeCommand(self, "ci", "dispatch", "--workflow", wf.workflow, "--ref", "main")
		}

	// ------------------------------------------------------------------
	case sectionPickVersion:
		if m.pendingScript != nil {
			option := m.optionMenu[m.optionCursor]
			args := append([]string{}, m.pendingScript.args...)
			args[len(args)-1] = args[len(args)-1] + option
			return m, executeCommand(m.pendingScript.command, args...)
		}

	// ------------------------------------------------------------------
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
// Command execution
// ---------------------------------------------------------------------------

type execFinishedMsg struct{ err error }

func executeCommand(name string, args ...string) tea.Cmd {
	cmd := exec.Command(name, args...)
	switch name {
	case "bun", "go", "git", "bash":
		cmd.Dir = findProjectRoot()
	}
	return tea.ExecProcess(cmd, func(err error) tea.Msg {
		return execFinishedMsg{err}
	})
}

func runShellScript(script string) tea.Cmd {
	var cmd *exec.Cmd
	root := findProjectRoot()
	if runtime.GOOS == "windows" {
		wrapped := fmt.Sprintf(`echo Working Directory: %s && %s & echo. & pause`, root, script)
		cmd = exec.Command("cmd", "/c", wrapped)
	} else {
		wrapped := fmt.Sprintf(`echo "Working Directory: %s"; %s; echo; read -rsp "Press Enter to return..." _`, root, script)
		cmd = exec.Command("bash", "-c", wrapped)
	}
	cmd.Dir = root
	return tea.ExecProcess(cmd, func(err error) tea.Msg {
		return execFinishedMsg{err}
	})
}

func openURL(url string) tea.Cmd {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", "", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	return tea.ExecProcess(cmd, func(err error) tea.Msg {
		return execFinishedMsg{err}
	})
}

func rebuildRunnerScript() string {
	if runtime.GOOS == "windows" {
		return `where go >NUL 2>NUL || (echo Error: Go not found. & exit /b 1)
if exist tools\dora-runner cd tools\dora-runner
go build -o ../../dora-runner . && echo Success! || echo Build failed.`
	}
	return `
if ! command -v go >/dev/null 2>&1; then
    echo "Error: Go is not installed or not in PATH."
    echo "  Arch/Manjaro: sudo pacman -S go"
    echo "  Ubuntu/Debian: sudo apt install golang-go"
    echo "  Or: https://go.dev/dl/"
    exit 1
fi
cd tools/dora-runner
go build -o ../../dora-runner . && echo "Success! Runner rebuilt." || echo "Build failed."
`
}

// ---------------------------------------------------------------------------
// Build file discovery
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
	root := findProjectRoot()
	bundleDir := filepath.Join(root, "apps/desktop/src-tauri/target/release/bundle")

	var files []buildFile
	filepath.WalkDir(bundleDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		var valid bool
		switch mode {
		case "exec":
			switch runtime.GOOS {
			case "windows":
				valid = ext == ".exe" || ext == ".msi"
			case "darwin":
				valid = ext == ".dmg"
			default:
				valid = ext == ".appimage"
			}
		case "deb":
			valid = ext == ".deb"
		default: // "all"
			valid = ext == ".appimage" || ext == ".deb" || ext == ".rpm" ||
				ext == ".dmg" || ext == ".exe" || ext == ".msi"
		}
		if !valid {
			return nil
		}
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
		return nil
	})

	sort.Slice(files, func(i, j int) bool {
		return files[i].ModTime.After(files[j].ModTime)
	})
	return files
}
