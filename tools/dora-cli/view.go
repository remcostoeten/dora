package main

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

var (
	appStyle = lipgloss.NewStyle().Margin(1, 2)

	titleStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFF")).
			Background(lipgloss.Color("#7D56F4")).
			Padding(0, 1).
			Bold(true)

	menuStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			Padding(1, 2).
			BorderForeground(lipgloss.Color("#874BFD"))

	selectedItemStyle = lipgloss.NewStyle().
				PaddingLeft(1).
				Foreground(lipgloss.Color("205")).
				Bold(true)

	itemStyle = lipgloss.NewStyle().
			PaddingLeft(2)

	statusStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("240")).
			MarginTop(1)
)

func (m model) View() string {
	var s strings.Builder

	// Header
	s.WriteString(titleStyle.Render("DORA CLI"))
	s.WriteString("\n\n")

	// Main Content based on current section
	switch m.currentSection {
	case sectionMain:
		s.WriteString(menuStyle.Render(m.mainMenuList()))
	case sectionRunApp, sectionBuildPlatform:
		s.WriteString(menuStyle.Render(m.subMenuList()))
	case sectionBuilds:
		s.WriteString(menuStyle.Render(m.buildsList()))
	case sectionCheckSizes:
		s.WriteString(menuStyle.Render(m.sizesList()))
	case sectionRelease, sectionAISetup, sectionDatabase:
		s.WriteString(menuStyle.Render(m.scriptMenuList()))
	case sectionPickVersion, sectionPickModel:
		s.WriteString(menuStyle.Render(m.optionMenuList()))
	}

	if m.executing {
		s.WriteString(fmt.Sprintf("\n%s Executing command...\n\n%s", m.spinner.View(), m.outputCmd))
	}

	// Footer / Status
	s.WriteString("\n")
	s.WriteString(statusStyle.Render("Use arrows to move, Space/Enter to select, Esc to back, Q to quit"))

	return appStyle.Render(s.String())
}

func (m model) mainMenuList() string {
	var s strings.Builder
	for i, choice := range m.mainMenu {
		cursor := " "
		if m.cursor == i {
			cursor = ">"
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf("%s %s", cursor, choice)))
		} else {
			s.WriteString(itemStyle.Render(fmt.Sprintf("%s %s", cursor, choice)))
		}
		s.WriteString("\n")
	}
	return s.String()
}

func (m model) subMenuList() string {
	var s strings.Builder
	// Title of submenu
	s.WriteString(lipgloss.NewStyle().Bold(true).Render(m.subMenuTitle) + "\n\n")
	
	for i, choice := range m.subMenu {
		cursor := " "
		if m.subCursor == i {
			cursor = ">"
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf("%s %s", cursor, choice.label)))
		} else {
			s.WriteString(itemStyle.Render(fmt.Sprintf("%s %s", cursor, choice.label)))
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
	s.WriteString(lipgloss.NewStyle().Bold(true).Render("Select a build to run:") + "\n\n")

	for i, build := range m.buildFiles {
		cursor := " "
		if m.buildCursor == i {
			cursor = ">"
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf("%s %s (%s)", cursor, build.Name, build.ModTime.Format("Jan 02 15:04"))))
		} else {
			s.WriteString(itemStyle.Render(fmt.Sprintf("%s %s (%s)", cursor, build.Name, build.ModTime.Format("Jan 02 15:04"))))
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
		cursor := " "
		style := itemStyle
		if m.buildCursor == i {
			cursor = ">"
			style = selectedItemStyle
		}

		// Simple fixed width column
		name := build.Name
		if len(name) > 40 {
			name = name[:37] + "..."
		}
		line := fmt.Sprintf("%-40s %s", name, build.SizeStr)
		
		if m.buildCursor == i {
			s.WriteString(style.Render(fmt.Sprintf("%s %s", cursor, line)))
		} else {
			s.WriteString(style.Render(fmt.Sprintf("%s %s", cursor, line)))
		}
		s.WriteString("\n")
	}
	return s.String()
}

func (m model) scriptMenuList() string {
	var s strings.Builder
	s.WriteString(lipgloss.NewStyle().Bold(true).Render(m.scriptTitle) + "\n\n")

	for i, script := range m.scriptMenu {
		cursor := " "
		if m.scriptCursor == i {
			cursor = ">"
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf("%s %s", cursor, script.label)))
		} else {
			s.WriteString(itemStyle.Render(fmt.Sprintf("%s %s", cursor, script.label)))
		}
		s.WriteString("\n")
		// Show description for selected item
		if m.scriptCursor == i {
			s.WriteString(lipgloss.NewStyle().
				Foreground(lipgloss.Color("240")).
				PaddingLeft(4).
				Render(script.description))
			s.WriteString("\n")
		}
	}
	return s.String()
}

func (m model) optionMenuList() string {
	var s strings.Builder
	s.WriteString(lipgloss.NewStyle().Bold(true).Render(m.optionTitle) + "\n\n")

	for i, option := range m.optionMenu {
		cursor := " "
		if m.optionCursor == i {
			cursor = ">"
			s.WriteString(selectedItemStyle.Render(fmt.Sprintf("%s %s", cursor, option)))
		} else {
			s.WriteString(itemStyle.Render(fmt.Sprintf("%s %s", cursor, option)))
		}
		s.WriteString("\n")
	}
	return s.String()
}
