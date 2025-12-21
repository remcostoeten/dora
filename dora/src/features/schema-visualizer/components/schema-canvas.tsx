"use client"

import { useRef, useState, useCallback, useMemo, useEffect } from "react"
import { useCanvas, useNodeDrag, useExport } from "../hooks"
import type { SchemaNode, SchemaRelation, VisualizerConfig } from "../types"
import type { ValidationResult } from "../utils/schema-validation"
import { validateSchema } from "../utils/schema-validation"
import { TableNode } from "./table-node"
import { RelationLine } from "./relation-line"
import { CanvasToolbar, type SidePanelType } from "./canvas-toolbar"
import { Minimap } from "./minimap"
import { DottedBackground } from "./dotted-background"
import { PlaygroundPanel } from "./playground-panel"
import { ValidationPanel } from "./validation-panel"
import { ExportPanel } from "./export-panel"
import type { ExampleSchema } from "../data/example-schemas"

type SchemaCanvasProps = {
  nodes: SchemaNode[]
  relations: SchemaRelation[]
  onNodesChange: (nodes: SchemaNode[]) => void
  onRelationsChange?: (relations: SchemaRelation[]) => void
  onOpenInDataView?: (tableName: string) => void
  onLoadExampleSchema?: (schema: ExampleSchema) => void
  currentSchemaId?: string
}

export function SchemaCanvas({
  nodes,
  relations,
  onNodesChange,
  onRelationsChange,
  onOpenInDataView,
  onLoadExampleSchema,
  currentSchemaId,
}: SchemaCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 })
  const [activeSidePanel, setActiveSidePanel] = useState<SidePanelType>(null)

  const [config, setConfig] = useState<VisualizerConfig>({
    showTypes: true,
    showNullable: true,
    showIndexes: false,
    highlightPrimaryKeys: true,
    highlightForeignKeys: true,
  })

  const { state: canvasState, handlers, controls } = useCanvas(containerRef)
  const { draggingId, handleDragStart, handleDragMove, handleDragEnd } = useNodeDrag(
    nodes,
    onNodesChange,
    canvasState.zoom,
  )
  const { exportToPng, exportToSvg } = useExport(canvasRef)

  const validation = useMemo<ValidationResult>(() => {
    return validateSchema(nodes, relations)
  }, [nodes, relations])

  // Update viewport size on resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setViewportSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Filter nodes by search
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes
    const query = searchQuery.toLowerCase()
    return nodes.filter(
      (node) =>
        node.name.toLowerCase().includes(query) || node.columns.some((col) => col.name.toLowerCase().includes(query)),
    )
  }, [nodes, searchQuery])

  // Highlighted relations based on selected node
  const highlightedRelations = useMemo(() => {
    if (!selectedNodeId) return new Set<string>()
    const selectedNode = nodes.find((n) => n.id === selectedNodeId)
    if (!selectedNode) return new Set<string>()

    return new Set(
      relations
        .filter((r) => r.sourceTable === selectedNode.name || r.targetTable === selectedNode.name)
        .map((r) => r.id),
    )
  }, [selectedNodeId, nodes, relations])

  const handleConfigChange = useCallback((partial: Partial<VisualizerConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }))
  }, [])

  const handleViewportChange = useCallback((x: number, y: number) => {
    console.log("Navigate to:", x, y)
  }, [])

  const handleFocusTable = useCallback(
    (tableName: string) => {
      const node = nodes.find((n) => n.name === tableName)
      if (node) {
        setSelectedNodeId(node.id)
        // Could also pan to the node here
      }
    },
    [nodes],
  )

  const renderSidePanel = () => {
    if (!activeSidePanel) return null

    return (
      <div className="absolute top-14 right-3 bottom-3 w-80 z-20 rounded-lg border bg-card/95 backdrop-blur-md shadow-xl overflow-hidden">
        {activeSidePanel === "playground" && (
          <PlaygroundPanel onLoadSchema={(schema) => onLoadExampleSchema?.(schema)} currentSchemaId={currentSchemaId} />
        )}
        {activeSidePanel === "validation" && (
          <ValidationPanel validation={validation} onFocusTable={handleFocusTable} />
        )}
        {activeSidePanel === "export" && <ExportPanel nodes={nodes} relations={relations} />}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-gradient-to-br from-background via-background to-background/95 select-none"
      onWheel={handlers.onWheel}
      onMouseDown={handlers.onMouseDown}
      onMouseMove={(e) => {
        handlers.onMouseMove(e)
        handleDragMove(e)
      }}
      onMouseUp={() => {
        handlers.onMouseUp()
        handleDragEnd()
      }}
      onMouseLeave={() => {
        handlers.onMouseUp()
        handleDragEnd()
      }}
    >
      {/* Dotted background */}
      <DottedBackground panX={canvasState.panX} panY={canvasState.panY} zoom={canvasState.zoom} />

      {/* Toolbar */}
      <CanvasToolbar
        zoom={canvasState.zoom}
        config={config}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onZoomIn={controls.zoomIn}
        onZoomOut={controls.zoomOut}
        onResetView={controls.resetView}
        onFitToScreen={controls.fitToScreen}
        onExportPng={exportToPng}
        onExportSvg={exportToSvg}
        onConfigChange={handleConfigChange}
        activeSidePanel={activeSidePanel}
        onSidePanelChange={setActiveSidePanel}
        validationErrorCount={validation.errors.length}
        validationWarningCount={validation.warnings.length}
      />

      {/* Side panel */}
      {renderSidePanel()}

      {/* Canvas content */}
      <div
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          transform: `translate(${canvasState.panX}px, ${canvasState.panY}px) scale(${canvasState.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Relation lines (SVG layer) */}
        <svg className="absolute inset-0 h-[5000px] w-[5000px] pointer-events-none overflow-visible">
          {relations.map((relation) => (
            <RelationLine
              key={relation.id}
              relation={relation}
              nodes={filteredNodes}
              isHighlighted={highlightedRelations.has(relation.id)}
            />
          ))}
        </svg>

        {/* Table nodes */}
        {filteredNodes.map((node) => (
          <TableNode
            key={node.id}
            node={node}
            config={config}
            isSelected={selectedNodeId === node.id}
            isDragging={draggingId === node.id}
            onSelect={setSelectedNodeId}
            onDragStart={handleDragStart}
            onOpenInDataView={onOpenInDataView}
          />
        ))}
      </div>

      {/* Minimap */}
      <Minimap
        nodes={filteredNodes}
        canvasState={canvasState}
        viewportWidth={viewportSize.width}
        viewportHeight={viewportSize.height}
        onViewportChange={handleViewportChange}
      />

      {/* Help hint */}
      <div className="absolute bottom-3 left-3 text-xs text-muted-foreground/70 bg-card/80 backdrop-blur-md px-3 py-1.5 rounded-md border border-border/40 shadow-lg">
        Scroll to pan | Ctrl+Scroll to zoom | Shift+Drag to pan
      </div>
    </div>
  )
}
