package main

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

var (
	// Theme Colors - Professional / Clean
	primaryColor   = lipgloss.Color("#5B60DD") // Muted Indigo
	secondaryColor = lipgloss.Color("#E1E1E1") // Off-white/Silver
	accentColor    = lipgloss.Color("#5bbcd6") // Muted Cyan
	subtleColor    = lipgloss.Color("#444444") // Dark Gray
	textColor      = lipgloss.Color("#DDDDDD") // Light Gray

	// Layout Styles
	appStyle = lipgloss.NewStyle().Margin(1, 1)

	// Component Styles
	titleStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFF")).
			Background(lipgloss.Color("#333")).
			Padding(0, 1).
			Bold(true).
			MarginBottom(1)

	windowStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder(), false, false, false, true). // Left border only
			BorderForeground(primaryColor).
			Padding(0, 2).
			Width(60)

	// List Item Styles
	selectedItemStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#FFF")).
				Background(primaryColor).
				Bold(true).
				Padding(0, 1)

	itemStyle = lipgloss.NewStyle().
			Foreground(textColor).
			PaddingLeft(1)

	// Status Bar Styles
	statusBarStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#888")).
			MarginTop(2)

	statusText = lipgloss.NewStyle().Foreground(subtleColor)
)

func (m model) View() string {
	var s strings.Builder

	// Header
	s.WriteString(titleStyle.Render("⚡ DORA RUNNER v2.0"))
	s.WriteString("\n")

	// Content Window
	var content string
	switch m.currentSection {
	case sectionMain:
		content = m.mainMenuList()
	case sectionRunApp, sectionBuildPlatform:
		content = m.subMenuList()
	case sectionBuilds:
		content = m.buildsList()
	case sectionCheckSizes:
		content = m.sizesList()
	case sectionRelease, sectionAISetup, sectionDatabase:
		content = m.scriptMenuList()
	case sectionPickVersion, sectionPickModel:
		content = m.optionMenuList()
	}

	if m.executing {
		content = fmt.Sprintf("\n%s\n\n%s", m.spinner.View(), lipgloss.NewStyle().Foreground(accentColor).Render(m.outputCmd))
	}

	s.WriteString(windowStyle.Render(content))

	// Footer / Status Bar
	keys := statusBarStyle.Render("ESC: Back") + " " + statusBarStyle.Render("Q: Quit") + " " + statusBarStyle.Render("ENTER: Select")
	s.WriteString("\n" + keys)

	return appStyle.Render(s.String())
}

func (m model) mainMenuList() string {
	var s strings.Builder
	for i, choice := range m.mainMenu {
		if m.cursor == i {
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf(" %s ", choice)))
		} else {
			s.WriteString(itemStyle.Render(fmt.Sprintf("%s", choice)))
		}
		s.WriteString("\n")
	}
	return s.String()
}

func (m model) subMenuList() string {
	var s strings.Builder
	// Title of submenu
	s.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#DDD")).Render(m.subMenuTitle) + "\n\n")
	
	for i, choice := range m.subMenu {
		if m.subCursor == i {
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf(" %s ", choice.label)))
		} else {
			s.WriteString(itemStyle.Render(fmt.Sprintf("%s", choice.label)))
		}
		s.WriteString("\n")
	}
	return s.String()
}


func (m model) buildsList() string {
	if len(m.buildFiles) == 0 {
		return "No builds found in target directory."
	}

	var s strings.Builder
	s.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#DDD")).Render("Select a build to run:") + "\n\n")

	for i, build := range m.buildFiles {
		if m.buildCursor == i {
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf(" %s (%s) ", build.Name, build.ModTime.Format("Jan 02 15:04"))))
		} else {
			s.WriteString(itemStyle.Render(fmt.Sprintf("%s (%s)", build.Name, build.ModTime.Format("Jan 02 15:04"))))
		}
		s.WriteString("\n")
	}
	return s.String()
}

func (m model) sizesList() string {
	if len(m.buildFiles) == 0 {
		return "No builds found in target directory."
	}

	var s strings.Builder
	s.WriteString(lipgloss.NewStyle().Bold(true).Render("Build Artifact Sizes") + "\n\n")
	// Header
	s.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Render("   File Name                                Size") + "\n")
	s.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Render("   ──────────────────────────────────────── ────────") + "\n")

	for i, build := range m.buildFiles {
		style := itemStyle
		if m.buildCursor == i {
			style = selectedItemStyle
		}

		// Simple fixed width column
		name := build.Name
		if len(name) > 40 {
			name = name[:37] + "..."
		}
		line := fmt.Sprintf("%-40s %s", name, build.SizeStr)
		
		if m.buildCursor == i {
			s.WriteString(style.Render(fmt.Sprintf(" %s ", line)))
		} else {
			s.WriteString(style.Render(fmt.Sprintf("%s", line)))
		}
		s.WriteString("\n")
	}
	return s.String()
}

func (m model) scriptMenuList() string {
	var s strings.Builder
	s.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#DDD")).Render(m.scriptTitle) + "\n\n")

	for i, script := range m.scriptMenu {
		if m.scriptCursor == i {
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf(" %s ", script.label)))
		} else {
			s.WriteString(itemStyle.Render(fmt.Sprintf("%s", script.label)))
		}
		s.WriteString("\n")
		// Show description for selected item
		if m.scriptCursor == i {
			s.WriteString(lipgloss.NewStyle().
				Foreground(lipgloss.Color("#666")).
				PaddingLeft(1).
				Italic(true).
				Render(script.description))
			s.WriteString("\n")
		}
	}
	return s.String()
}

func (m model) optionMenuList() string {
	var s strings.Builder
	s.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#DDD")).Render(m.optionTitle) + "\n\n")

	for i, option := range m.optionMenu {
		if m.optionCursor == i {
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf(" %s ", option)))
		} else {
			s.WriteString(itemStyle.Render(fmt.Sprintf("%s", option)))
		}
		s.WriteString("\n")
	}
	return s.String()
}
