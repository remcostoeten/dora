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

	// Main Content
	if m.inSubmenu {
		s.WriteString(menuStyle.Render(m.subMenuList()))
	} else if m.viewingBuilds {
		s.WriteString(menuStyle.Render(m.buildsList()))
	} else if m.executing {
		s.WriteString(fmt.Sprintf("%s Executing command...\n\n%s", m.spinner.View(), m.outputCmd))
	} else {
		s.WriteString(menuStyle.Render(m.mainMenuList()))
	}

	// Footer / Status
	s.WriteString("\n")
	s.WriteString(statusStyle.Render("Use arrows to move, Space/Enter to select, Esc to back/cancel, Q to quit"))

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
