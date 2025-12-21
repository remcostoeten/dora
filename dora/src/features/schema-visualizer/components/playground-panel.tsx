"use client"

import { useState } from "react"
import {
  Play,
  Sparkles,
  MessageSquare,
  ShoppingCart,
  Building2,
  BarChart3,
  FileText,
  ChevronRight,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { EXAMPLE_SCHEMAS, type ExampleSchema } from "../data/example-schemas"

type PlaygroundPanelProps = {
  onLoadSchema: (schema: ExampleSchema) => void
  currentSchemaId?: string
}

const categoryIcons = {
  social: MessageSquare,
  ecommerce: ShoppingCart,
  saas: Building2,
  content: FileText,
  analytics: BarChart3,
}

const complexityColors = {
  beginner: "bg-green-500/20 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/20 text-red-400 border-red-500/30",
}

export function PlaygroundPanel({ onLoadSchema, currentSchemaId }: PlaygroundPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<ExampleSchema["category"] | "all">("all")

  const filteredSchemas =
    selectedCategory === "all" ? EXAMPLE_SCHEMAS : EXAMPLE_SCHEMAS.filter((s) => s.category === selectedCategory)

  const categories = [
    { id: "all" as const, label: "All", icon: Sparkles },
    { id: "social" as const, label: "Social", icon: MessageSquare },
    { id: "ecommerce" as const, label: "E-Commerce", icon: ShoppingCart },
    { id: "saas" as const, label: "SaaS", icon: Building2 },
    { id: "content" as const, label: "Content", icon: FileText },
    { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
  ]

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
          <Play className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-sm">Playground</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p>
                Load example schemas to learn database design patterns. Each example demonstrates real-world schema
                architectures.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1 border-b border-border/50 px-3 py-2">
          {categories.map((cat) => {
            const Icon = cat.icon
            const isActive = selectedCategory === cat.id
            return (
              <Button
                key={cat.id}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSelectedCategory(cat.id)}
              >
                <Icon className="h-3 w-3 mr-1" />
                {cat.label}
              </Button>
            )
          })}
        </div>

        {/* Schema list */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {filteredSchemas.map((schema) => {
              const CategoryIcon = categoryIcons[schema.category]
              const isActive = currentSchemaId === schema.id

              return (
                <button
                  key={schema.id}
                  onClick={() => onLoadSchema(schema)}
                  className={`w-full text-left rounded-lg border p-3 transition-all hover:bg-accent/50 ${
                    isActive ? "border-primary bg-primary/10" : "border-border/50 bg-card/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`rounded-md p-1.5 ${isActive ? "bg-primary/20" : "bg-muted"}`}>
                      <CategoryIcon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{schema.name}</span>
                        {isActive && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{schema.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4 ${complexityColors[schema.complexity]}`}
                        >
                          {schema.complexity}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{schema.nodes.length} tables</span>
                        <span className="text-[10px] text-muted-foreground">{schema.relations.length} relations</span>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 text-muted-foreground transition-transform ${isActive ? "rotate-90" : ""}`}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>

        {/* Footer tip */}
        <div className="border-t border-border/50 px-4 py-3">
          <p className="text-[11px] text-muted-foreground">
            Click on a schema to load it into the visualizer. You can modify and export the schema.
          </p>
        </div>
      </div>
    </TooltipProvider>
  )
}
