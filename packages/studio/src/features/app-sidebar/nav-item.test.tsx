import { fireEvent, render, screen } from '@testing-library/react'
import type { LucideProps } from 'lucide-react'
import { forwardRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@studio/shared/ui/tooltip'
import { SidebarNavItem } from './nav-item'
import type { NavItem } from './types'

type Probe = { renders: number }

function probedItem(id: string, label: string, probe: Probe): NavItem {
	const Icon = forwardRef<SVGSVGElement, LucideProps>(function ProbeIcon(_props, ref) {
		probe.renders += 1
		return <svg ref={ref} />
	})
	return { id, label, icon: Icon }
}

describe('SidebarNavItem', () => {
	it('re-renders only the items whose active state changed', () => {
		const probes = { console: { renders: 0 }, viewer: { renders: 0 }, docker: { renders: 0 } }
		const items = [
			probedItem('sql-console', 'SQL Console', probes.console),
			probedItem('database-studio', 'Data Viewer', probes.viewer),
			probedItem('docker', 'Docker Manager', probes.docker)
		]
		const onNavigate = vi.fn()
		function Nav({ activeId }: { activeId: string }) {
			return (
				<TooltipProvider>
					{items.map((item) => (
						<SidebarNavItem
							key={item.id}
							item={item}
							isActive={item.id === activeId}
							onNavigate={onNavigate}
						/>
					))}
				</TooltipProvider>
			)
		}

		const view = render(<Nav activeId='database-studio' />)
		const afterMount = {
			console: probes.console.renders,
			viewer: probes.viewer.renders,
			docker: probes.docker.renders
		}

		view.rerender(<Nav activeId='database-studio' />)
		expect(probes.console.renders).toBe(afterMount.console)
		expect(probes.viewer.renders).toBe(afterMount.viewer)
		expect(probes.docker.renders).toBe(afterMount.docker)

		view.rerender(<Nav activeId='sql-console' />)
		expect(probes.console.renders).toBe(afterMount.console + 1)
		expect(probes.viewer.renders).toBe(afterMount.viewer + 1)
		expect(probes.docker.renders).toBe(afterMount.docker)
	})

	it('reports the item id when it is clicked', () => {
		const onNavigate = vi.fn()
		const item = probedItem('docker', 'Docker Manager', { renders: 0 })
		render(
			<TooltipProvider>
				<SidebarNavItem item={item} onNavigate={onNavigate} />
			</TooltipProvider>
		)

		fireEvent.click(screen.getByRole('menuitem', { name: 'Docker Manager' }))

		expect(onNavigate).toHaveBeenCalledWith('docker')
	})
})
