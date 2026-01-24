import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SORT, DEFAULT_FILTER } from '../constants'
import type {
	ContainerSortConfig,
	ContainerSortField,
	SortDirection,
	ContainerFilterConfig,
	ContainerEvent,
	ContainerEventType,
	ProjectLink
} from '../types'

const MAX_EVENTS = 500

type DockerManagerState = {
	sort: ContainerSortConfig
	filter: ContainerFilterConfig
	showExternal: boolean
	events: ContainerEvent[]
	projectLinks: ProjectLink[]
}

type DockerManagerActions = {
	setSort: (sort: ContainerSortConfig) => void
	setSortField: (field: ContainerSortField) => void
	toggleSortDirection: () => void
	setFilter: (filter: ContainerFilterConfig) => void
	resetFilter: () => void
	setShowExternal: (show: boolean) => void
	addEvent: (event: Omit<ContainerEvent, 'id' | 'timestamp'>) => void
	clearHistory: (containerId?: string) => void
	linkProject: (link: ProjectLink) => void
	unlinkProject: (containerId: string) => void
}

export const useDockerManagerStore = create<DockerManagerState & DockerManagerActions>()(
	persist(
		function (set) {
			return {
				sort: DEFAULT_SORT,
				filter: DEFAULT_FILTER,
				showExternal: false,
				events: [],
				projectLinks: [],

				setSort: function (sort) {
					set({ sort })
				},

				setSortField: function (field) {
					set(function (state) {
						return { sort: { ...state.sort, field } }
					})
				},

				toggleSortDirection: function () {
					set(function (state) {
						const direction: SortDirection = state.sort.direction === 'asc' ? 'desc' : 'asc'
						return { sort: { ...state.sort, direction } }
					})
				},

				setFilter: function (filter) {
					set({ filter })
				},

				resetFilter: function () {
					set({ filter: DEFAULT_FILTER })
				},

				setShowExternal: function (show) {
					set({ showExternal: show })
				},

				addEvent: function (event) {
					set(function (state) {
						const newEvent: ContainerEvent = {
							...event,
							id: crypto.randomUUID(),
							timestamp: Date.now()
						}
						const events = [newEvent, ...state.events].slice(0, MAX_EVENTS)
						return { events }
					})
				},

				clearHistory: function (containerId) {
					set(function (state) {
						if (containerId) {
							return {
								events: state.events.filter(function (e) {
									return e.containerId !== containerId
								})
							}
						}
						return { events: [] }
					})
				},

				linkProject: function (link) {
					set(function (state) {
						const filtered = state.projectLinks.filter(function (l) {
							return l.containerId !== link.containerId
						})
						return { projectLinks: [...filtered, link] }
					})
				},

				unlinkProject: function (containerId) {
					set(function (state) {
						return {
							projectLinks: state.projectLinks.filter(function (l) {
								return l.containerId !== containerId
							})
						}
					})
				}
			}
		},
		{
			name: 'dora-docker-manager',
			partialize: function (state) {
				return {
					sort: state.sort,
					filter: state.filter,
					showExternal: state.showExternal,
					events: state.events,
					projectLinks: state.projectLinks
				}
			}
		}
	)
)
