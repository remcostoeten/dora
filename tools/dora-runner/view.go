package main

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

var (
	primaryColor = lipgloss.Color("#5B60DD")
	accentColor  = lipgloss.Color("#5bbcd6")
	textColor    = lipgloss.Color("#DDDDDD")
	dimColor     = lipgloss.Color("#555555")

	appStyle = lipgloss.NewStyle().Margin(1, 1)

	titleStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFF")).
			Background(lipgloss.Color("#333")).
			Padding(0, 1).
			Bold(true).
			MarginBottom(1)

	windowStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder(), false, false, false, true).
			BorderForeground(primaryColor).
			Padding(0, 2).
			Width(64)

	selectedItemStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#FFF")).
				Background(primaryColor).
				Bold(true).
				Padding(0, 1)

	itemStyle = lipgloss.NewStyle().
			Foreground(textColor).
			PaddingLeft(1)

	separatorStyle = lipgloss.NewStyle().
			Foreground(dimColor).
			PaddingLeft(1)

	descStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#666")).
			PaddingLeft(2).
			Italic(true)

	statusBarStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#888")).
			MarginTop(1)
)

func (m model) View() string {
	var s strings.Builder

	s.WriteString(titleStyle.Render("⚡ DORA RUNNER"))
	s.WriteString("\n")

	var content string
	switch m.currentSection {
	case sectionMain:
		content = m.mainMenuList()
	case sectionRunApp, sectionBuildPlatform, sectionVM:
		content = m.subMenuList()
	case sectionBuilds:
		content = m.buildsList("Select a build to run:")
	case sectionInstallBuild:
		content = m.buildsList("Select .deb to install:")
	case sectionReinstall:
		content = m.buildsList("Select .deb to reinstall:")
	case sectionCheckSizes:
		content = m.sizesList()
	case sectionDatabase, sectionReleaseNotes, sectionReleasePackaging,
		sectionTests, sectionLinting, sectionSEO, sectionAISetup, sectionDevTools:
		content = m.scriptMenuList()
	case sectionCI:
		content = m.ciMenuList()
	case sectionPickVersion, sectionPickModel:
		content = m.optionMenuList()
	}

	if m.executing {
		content = fmt.Sprintf("\n%s\n\n%s",
			m.spinner.View(),
			lipgloss.NewStyle().Foreground(accentColor).Render(m.outputCmd),
		)
	}

	s.WriteString(windowStyle.Render(content))

	if !m.executing && m.outputCmd != "" {
		s.WriteString("\n" + lipgloss.NewStyle().Foreground(accentColor).PaddingLeft(3).Render(m.outputCmd))
	}

	s.WriteString("\n" + statusBarStyle.Render("↑↓/jk: navigate   ENTER: select   ESC: back   q: quit"))

	return appStyle.Render(s.String())
}

func (m model) mainMenuList() string {
	var s strings.Builder
	for i, item := range m.mainMenu {
		if isSeparator(item) {
			s.WriteString(separatorStyle.Render(item))
		} else if m.cursor == i {
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf(" %s ", item)))
		} else {
			s.WriteString(itemStyle.Render(item))
		}
		s.WriteString("\n")
	}
	return s.String()
}

func (m model) subMenuList() string {
	var s strings.Builder
	s.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#DDD")).Render(m.subMenuTitle))
	s.WriteString("\n\n")
	for i, choice := range m.subMenu {
		if m.subCursor == i {
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf(" %s ", choice.label)))
		} else {
			s.WriteString(itemStyle.Render(choice.label))
		}
		s.WriteString("\n")
	}
	return s.String()
}

func (m model) buildsList(title string) string {
	if len(m.buildFiles) == 0 {
		return "No builds found.\nRun a build target first."
	}
	var s strings.Builder
	s.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#DDD")).Render(title))
	s.WriteString("\n\n")
	for i, build := range m.buildFiles {
		label := fmt.Sprintf("%s  (%s)", build.Name, build.ModTime.Format("Jan 02 15:04"))
		if m.buildCursor == i {
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf(" %s ", label)))
		} else {
			s.WriteString(itemStyle.Render(label))
		}
		s.WriteString("\n")
	}
	return s.String()
}

func (m model) sizesList() string {
	if len(m.buildFiles) == 0 {
		return "No builds found."
	}
	var s strings.Builder
	s.WriteString(lipgloss.NewStyle().Bold(true).Render("Build Artifact Sizes"))
	s.WriteString("\n\n")
	s.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Render("   File Name                                Size"))
	s.WriteString("\n")
	s.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Render("   ──────────────────────────────────────── ────────"))
	s.WriteString("\n")
	for i, build := range m.buildFiles {
		name := build.Name
		if len(name) > 40 {
			name = name[:37] + "..."
		}
		line := fmt.Sprintf("%-40s %s", name, build.SizeStr)
		if m.buildCursor == i {
			s.WriteString(selectedItemStyle.Render(" " + line + " "))
		} else {
			s.WriteString(itemStyle.Render(line))
		}
		s.WriteString("\n")
	}
	return s.String()
}

func (m model) scriptMenuList() string {
	var s strings.Builder
	s.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#DDD")).Render(m.scriptTitle))
	s.WriteString("\n\n")
	for i, script := range m.scriptMenu {
		if m.scriptCursor == i {
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf(" %s ", script.label)))
			s.WriteString("\n")
			s.WriteString(descStyle.Render(script.description))
		} else {
			s.WriteString(itemStyle.Render(script.label))
		}
		s.WriteString("\n")
	}
	return s.String()
}

func (m model) ciMenuList() string {
	var s strings.Builder
	s.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#DDD")).Render("CI Dispatch (gh workflow run)"))
	s.WriteString("\n\n")
	for i, wf := range m.ciMenu {
		if m.ciCursor == i {
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf(" %s ", wf.label)))
			s.WriteString("\n")
			s.WriteString(descStyle.Render(wf.description + "  [" + wf.workflow + "]"))
		} else {
			s.WriteString(itemStyle.Render(wf.label))
		}
		s.WriteString("\n")
	}
	return s.String()
}

func (m model) optionMenuList() string {
	var s strings.Builder
	s.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#DDD")).Render(m.optionTitle))
	s.WriteString("\n\n")
	for i, option := range m.optionMenu {
		if m.optionCursor == i {
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf(" %s ", option)))
		} else {
			s.WriteString(itemStyle.Render(option))
		}
		s.WriteString("\n")
	}
	return s.String()
}
