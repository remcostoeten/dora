"use client"

import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Download,
  ImageIcon,
  FileCode,
  Settings2,
  Search,
  Play,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import type { VisualizerConfig } from "../types"

export type SidePanelType = "playground" | "validation" | "export" | null

type CanvasToolbarProps = {
  zoom: number
  config: VisualizerConfig
  searchQuery: string
  onSearchChange: (query: string) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onFitToScreen: () => void
  onExportPng: () => void
  onExportSvg: () => void
  onConfigChange: (config: Partial<VisualizerConfig>) => void
  activeSidePanel: SidePanelType
  onSidePanelChange: (panel: SidePanelType) => void
  validationErrorCount?: number
  validationWarningCount?: number
}

export function CanvasToolbar({
  zoom,
  config,
  searchQuery,
  onSearchChange,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitToScreen,
  onExportPng,
  onExportSvg,
  onConfigChange,
  activeSidePanel,
  onSidePanelChange,
  validationErrorCount = 0,
  validationWarningCount = 0,
}: CanvasToolbarProps) {
  const hasValidationIssues = validationErrorCount > 0 || validationWarningCount > 0

  return (
    <TooltipProvider>
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-3">
        {/* Left side - Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tables..."
            className="w-64 pl-9 h-9 bg-card/80 backdrop-blur-sm"
          />
        </div>

        {/* Center - Feature panels */}
        <div className="flex items-center gap-1 rounded-md border bg-card/80 backdrop-blur-sm p-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeSidePanel === "playground" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 gap-1.5"
                onClick={() => onSidePanelChange(activeSidePanel === "playground" ? null : "playground")}
              >
                <Play className="h-3.5 w-3.5" />
                <span className="text-xs">Playground</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Load example schemas</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeSidePanel === "validation" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 gap-1.5"
                onClick={() => onSidePanelChange(activeSidePanel === "validation" ? null : "validation")}
              >
                <AlertCircle className={`h-3.5 w-3.5 ${validationErrorCount > 0 ? "text-destructive" : ""}`} />
                <span className="text-xs">Validate</span>
                {hasValidationIssues && (
                  <Badge
                    variant={validationErrorCount > 0 ? "destructive" : "outline"}
                    className="h-4 px-1 text-[10px] ml-0.5"
                  >
                    {validationErrorCount + validationWarningCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Validate schema</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeSidePanel === "export" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 gap-1.5"
                onClick={() => onSidePanelChange(activeSidePanel === "export" ? null : "export")}
              >
                <Download className="h-3.5 w-3.5" />
                <span className="text-xs">Export</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export to SQL/ORM</TooltipContent>
          </Tooltip>
        </div>

        {/* Right side - Controls */}
        <div className="flex items-center gap-1 rounded-md border bg-card/80 backdrop-blur-sm p-1">
          {/* Zoom controls */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomOut}>
                <ZoomOut className="h-4 w-4" />
                <span className="sr-only">Zoom out</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>

          <span className="w-12 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomIn}>
                <ZoomIn className="h-4 w-4" />
                <span className="sr-only">Zoom in</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onFitToScreen}>
                <Maximize2 className="h-4 w-4" />
                <span className="sr-only">Fit to screen</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to screen</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onResetView}>
                <RotateCcw className="h-4 w-4" />
                <span className="sr-only">Reset view</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset view</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-5" />

          {/* Image Export dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <ImageIcon className="h-4 w-4" />
                    <span className="sr-only">Export image</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Export as image</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export as image</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onExportPng}>
                <ImageIcon className="h-4 w-4 mr-2" />
                PNG Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportSvg}>
                <FileCode className="h-4 w-4 mr-2" />
                SVG Vector
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Settings dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Settings2 className="h-4 w-4" />
                    <span className="sr-only">Display settings</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Display settings</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Display Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={config.showTypes}
                onCheckedChange={(checked) => onConfigChange({ showTypes: checked })}
              >
                Show data types
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={config.showNullable}
                onCheckedChange={(checked) => onConfigChange({ showNullable: checked })}
              >
                Show nullable
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={config.highlightPrimaryKeys}
                onCheckedChange={(checked) => onConfigChange({ highlightPrimaryKeys: checked })}
              >
                Highlight primary keys
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={config.highlightForeignKeys}
                onCheckedChange={(checked) => onConfigChange({ highlightForeignKeys: checked })}
              >
                Highlight foreign keys
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  )
}
