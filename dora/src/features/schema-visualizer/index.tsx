"use client"

import { useState, useCallback, useEffect } from "react"
import { GitBranch, Play } from "lucide-react"
import { EmptyState } from "@/shared/components/empty-state"
import { SchemaCanvas } from "./components/schema-canvas"
import type { SchemaNode, SchemaRelation } from "./types"
import type { ExampleSchema } from "./data/example-schemas"
import { enhance } from "./utils/enhance-layout"
import { useConn } from "@/store"
import { db } from "@/services/database"

// Fallback mock data for playground mode
const PLAYGROUND_SCHEMA_NODES: SchemaNode[] = [
  {
    id: "users",
    name: "users",
    columns: [
      { name: "id", type: "int", isPrimary: true, isNullable: false },
      { name: "full_name", type: "varchar", isNullable: false },
      { name: "email", type: "varchar", isNullable: false },
      { name: "created_at", type: "timestamp", isNullable: false },
      {
        name: "country_code",
        type: "int",
        isNullable: true,
        isForeignKey: true,
        references: { table: "countries", column: "code" },
      },
    ],
    position: { x: 50, y: 50 },
  },
  {
    id: "countries",
    name: "countries",
    columns: [
      { name: "code", type: "int", isPrimary: true, isNullable: false },
      { name: "name", type: "varchar", isNullable: false },
      { name: "continent_name", type: "varchar", isNullable: true },
    ],
    position: { x: 400, y: 30 },
  },
  {
    id: "orders",
    name: "orders",
    columns: [
      { name: "id", type: "int", isPrimary: true, isNullable: false },
      {
        name: "user_id",
        type: "int",
        isNullable: false,
        isForeignKey: true,
        references: { table: "users", column: "id" },
      },
      { name: "status", type: "varchar", isNullable: false },
      { name: "created_at", type: "timestamp", isNullable: false },
    ],
    position: { x: 50, y: 300 },
  },
  {
    id: "products",
    name: "products",
    columns: [
      { name: "id", type: "int", isPrimary: true, isNullable: false },
      { name: "name", type: "varchar", isNullable: false },
      {
        name: "merchant_id",
        type: "int",
        isNullable: false,
        isForeignKey: true,
        references: { table: "merchants", column: "id" },
      },
      { name: "price", type: "int", isNullable: false },
      { name: "status", type: "varchar", isNullable: true },
      { name: "created_at", type: "datetime", isNullable: false },
    ],
    position: { x: 50, y: 520 },
  },
  {
    id: "merchants",
    name: "merchants",
    columns: [
      { name: "id", type: "int", isPrimary: true, isNullable: false },
      {
        name: "country_code",
        type: "int",
        isNullable: true,
        isForeignKey: true,
        references: { table: "countries", column: "code" },
      },
      { name: "merchant_name", type: "varchar", isNullable: false },
      { name: "created_at", type: "timestamp", isNullable: false },
      { name: "admin_id", type: "int", isNullable: true },
    ],
    position: { x: 400, y: 280 },
  },
  {
    id: "order_items",
    name: "order_items",
    columns: [
      {
        name: "order_id",
        type: "int",
        isPrimary: true,
        isNullable: false,
        isForeignKey: true,
        references: { table: "orders", column: "id" },
      },
      {
        name: "product_id",
        type: "int",
        isPrimary: true,
        isNullable: false,
        isForeignKey: true,
        references: { table: "products", column: "id" },
      },
      { name: "quantity", type: "int", isNullable: false },
    ],
    position: { x: 700, y: 450 },
  },
]

const PLAYGROUND_RELATIONS: SchemaRelation[] = [
  {
    id: "r1",
    sourceTable: "users",
    sourceColumn: "country_code",
    targetTable: "countries",
    targetColumn: "code",
    type: "one-to-many",
  },
  {
    id: "r2",
    sourceTable: "orders",
    sourceColumn: "user_id",
    targetTable: "users",
    targetColumn: "id",
    type: "one-to-many",
  },
  {
    id: "r3",
    sourceTable: "merchants",
    sourceColumn: "country_code",
    targetTable: "countries",
    targetColumn: "code",
    type: "one-to-many",
  },
  {
    id: "r4",
    sourceTable: "products",
    sourceColumn: "merchant_id",
    targetTable: "merchants",
    targetColumn: "id",
    type: "one-to-many",
  },
  {
    id: "r5",
    sourceTable: "order_items",
    sourceColumn: "order_id",
    targetTable: "orders",
    targetColumn: "id",
    type: "one-to-many",
  },
  {
    id: "r6",
    sourceTable: "order_items",
    sourceColumn: "product_id",
    targetTable: "products",
    targetColumn: "id",
    type: "one-to-many",
  },
]

type SchemaVisualizerProps = {
  isConnected?: boolean
  onOpenInDataView?: (tableName: string) => void
}

export function SchemaVisualizer({ isConnected: propIsConnected, onOpenInDataView }: SchemaVisualizerProps) {
  // Get connection state from store
  const { activeId, tables, connections } = useConn()
  const activeConnection = connections.find((c) => c.id === activeId)

  // Use prop or derive from store
  const isConnected = propIsConnected ?? !!activeId
  const isPlayground = !isConnected

  const [nodes, setNodes] = useState<SchemaNode[]>([])
  const [relations, setRelations] = useState<SchemaRelation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentSchemaId, setCurrentSchemaId] = useState<string | undefined>()
  const [mode, setMode] = useState<"database" | "playground">("database")

  const applyLayout = useCallback((schemaNodes: SchemaNode[], schemaRelations: SchemaRelation[]) => {
    const enhanceInput = schemaNodes.map((node) => ({
      id: node.id,
      width: 240,
      height: 36 + node.columns.length * 28,
    }))

    const enhanceEdges = schemaRelations.map((rel) => ({
      from: rel.sourceTable,
      to: rel.targetTable,
    }))

    const layoutResult = enhance(enhanceInput, enhanceEdges)

    return schemaNodes.map((node) => {
      const enhancedPos = layoutResult.nodes.find((n) => n.id === node.id)
      return {
        ...node,
        position: enhancedPos ? { x: enhancedPos.x, y: enhancedPos.y } : node.position,
      }
    })
  }, [])

  // Load schema data based on mode
  useEffect(() => {
    if (mode === "playground" || !isConnected) {
      // Load playground/example schema
      const enhancedNodes = applyLayout(PLAYGROUND_SCHEMA_NODES, PLAYGROUND_RELATIONS)
      setNodes(enhancedNodes)
      setRelations(PLAYGROUND_RELATIONS)
      setCurrentSchemaId("playground")
      return
    }

    const loadSchema = async () => {
      setIsLoading(true)
      try {
        console.log(`[Schema] Loading schema for: ${activeConnection?.name ?? "unknown"}`)
        await new Promise((resolve) => setTimeout(resolve, 300))

        // For demo, use playground data but could fetch from db.fetchSchema
        const enhancedNodes = applyLayout(PLAYGROUND_SCHEMA_NODES, PLAYGROUND_RELATIONS)
        setNodes(enhancedNodes)
        setRelations(PLAYGROUND_RELATIONS)
        setCurrentSchemaId(activeId ?? undefined)
      } catch (err) {
        console.error("Failed to load schema:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadSchema()
  }, [isConnected, mode, activeId, activeConnection?.name, applyLayout])

  const handleNodesChange = useCallback((updatedNodes: SchemaNode[]) => {
    setNodes(updatedNodes)
  }, [])

  const handleRelationsChange = useCallback((updatedRelations: SchemaRelation[]) => {
    setRelations(updatedRelations)
  }, [])

  const handleLoadExampleSchema = useCallback(
    (schema: ExampleSchema) => {
      const enhancedNodes = applyLayout(schema.nodes, schema.relations)
      setNodes(enhancedNodes)
      setRelations(schema.relations)
      setCurrentSchemaId(schema.id)
    },
    [applyLayout],
  )

  if (!isConnected) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <EmptyState
          icon={GitBranch}
          title="Schema Visualizer"
          desc="Connect to a database to explore your schema with interactive diagrams. View table relationships, foreign keys, and data types."
          act={{
            label: "Connect Database",
            onPress: () => {
              console.log("Open connection dialog")
            },
          }}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading schema...</p>
        </div>
      </div>
    )
  }

  return (
    <SchemaCanvas
      nodes={nodes}
      relations={relations}
      onNodesChange={handleNodesChange}
      onRelationsChange={handleRelationsChange}
      onOpenInDataView={onOpenInDataView}
      onLoadExampleSchema={handleLoadExampleSchema}
      currentSchemaId={currentSchemaId}
    />
  )
}
