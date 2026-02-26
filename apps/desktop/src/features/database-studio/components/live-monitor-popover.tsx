import { Activity, Settings2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { cn } from '@/shared/utils/cn'
import type { LiveMonitorConfig, ChangeType } from '../hooks/use-live-monitor'

type TProps = {
    config: LiveMonitorConfig
    onConfigChange: (config: LiveMonitorConfig) => void
    isPolling: boolean
}

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
    insert: 'Inserts',
    update: 'Updates',
    delete: 'Deletes'
}

const CHANGE_TYPE_COLORS: Record<ChangeType, string> = {
    insert: 'text-emerald-400',
    update: 'text-amber-400',
    delete: 'text-red-400'
}

function formatInterval(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    return `${ms / 1000}s`
}

export function LiveMonitorPopover({ config, onConfigChange, isPolling }: TProps) {
    function handleToggleEnabled(enabled: boolean) {
        onConfigChange({ ...config, enabled })
    }

    function handleIntervalChange(value: number[]) {
        onConfigChange({ ...config, intervalMs: value[0] })
    }

    function handleToggleChangeType(changeType: ChangeType, checked: boolean) {
        const currentTypes = config.subscription.changeTypes
        const nextTypes = checked
            ? [...currentTypes, changeType]
            : currentTypes.filter(function (t) { return t !== changeType })

        if (nextTypes.length === 0) return

        onConfigChange({
            ...config,
            subscription: { ...config.subscription, changeTypes: nextTypes }
        })
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        'h-7 w-7 relative',
                        config.enabled && 'text-emerald-400'
                    )}
                    title={config.enabled ? 'Live monitor active' : 'Live monitor off'}
                >
                    <Activity className={cn(
                        'h-4 w-4',
                        config.enabled && isPolling && 'animate-pulse'
                    )} />
                    {config.enabled && (
                        <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-72 p-0"
                align="end"
                sideOffset={8}
            >
                <div className="p-3 border-b border-sidebar-border">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Live Monitor</span>
                        </div>
                        <Switch
                            checked={config.enabled}
                            onCheckedChange={handleToggleEnabled}
                        />
                    </div>
                </div>

                <div className={cn(
                    'transition-opacity',
                    !config.enabled && 'opacity-50 pointer-events-none'
                )}>
                    <div className="p-3 border-b border-sidebar-border">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground">Poll interval</span>
                            <span className="text-xs font-mono text-foreground">
                                {formatInterval(config.intervalMs)}
                            </span>
                        </div>
                        <Slider
                            value={[config.intervalMs]}
                            onValueChange={handleIntervalChange}
                            min={2000}
                            max={30000}
                            step={1000}
                            className="w-full"
                        />
                        <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-muted-foreground">2s</span>
                            <span className="text-[10px] text-muted-foreground">30s</span>
                        </div>
                    </div>

                    <div className="p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Notify me about</span>
                        </div>
                        <div className="space-y-2">
                            {(['insert', 'update', 'delete'] as ChangeType[]).map(function (changeType) {
                                return (
                                    <label
                                        key={changeType}
                                        className="flex items-center gap-2 cursor-pointer"
                                    >
                                        <Checkbox
                                            checked={config.subscription.changeTypes.includes(changeType)}
                                            onCheckedChange={function (checked) {
                                                handleToggleChangeType(changeType, checked === true)
                                            }}
                                        />
                                        <span className={cn('text-sm', CHANGE_TYPE_COLORS[changeType])}>
                                            {CHANGE_TYPE_LABELS[changeType]}
                                        </span>
                                    </label>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
