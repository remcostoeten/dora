"use client"

import { useState } from "react"
import { Download, Copy, Check, Database, Code, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { exportSchema, EXPORT_FORMATS, type ExportFormat, type ExportOptions } from "../utils/schema-export"
import type { SchemaNode, SchemaRelation } from "../types"

type ExportPanelProps = {
  nodes: SchemaNode[]
  relations: SchemaRelation[]
}

const formatIcons = {
  database: Database,
  code: Code,
  "file-text": FileText,
}

export function ExportPanel({ nodes, relations }: ExportPanelProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("postgresql")
  const [options, setOptions] = useState<ExportOptions>({
    format: "postgresql",
    includeDropStatements: false,
    includeIndexes: true,
    schemaName: "",
  })
  const [copied, setCopied] = useState(false)

  const exportedCode = exportSchema(nodes, relations, { ...options, format: selectedFormat })

  const handleCopy = async () => {
    await navigator.clipboard.writeText(exportedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const format = EXPORT_FORMATS.find((f) => f.id === selectedFormat)
    const blob = new Blob([exportedCode], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `schema.${format?.extension || "sql"}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
        <Download className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-sm">Export Schema</h3>
      </div>

      <Tabs defaultValue="format" className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-3 grid grid-cols-2">
          <TabsTrigger value="format" className="text-xs">
            Format
          </TabsTrigger>
          <TabsTrigger value="options" className="text-xs">
            Options
          </TabsTrigger>
        </TabsList>

        <TabsContent value="format" className="flex-1 flex flex-col mt-0 p-3">
          {/* Format selection */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {EXPORT_FORMATS.map((format) => {
              const Icon = formatIcons[format.icon as keyof typeof formatIcons] || FileText
              const isActive = selectedFormat === format.id

              return (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format.id)}
                  className={`flex items-center gap-2 rounded-md border p-2 transition-all text-left ${
                    isActive ? "border-primary bg-primary/10" : "border-border/50 hover:bg-accent/50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-xs font-medium">{format.name}</p>
                    <p className="text-[10px] text-muted-foreground">.{format.extension}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Preview</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleCopy}>
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="ml-1 text-xs">{copied ? "Copied" : "Copy"}</span>
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" />
                  <span className="ml-1 text-xs">Download</span>
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 rounded-md border bg-muted/30">
              <pre className="p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap">{exportedCode}</pre>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="options" className="mt-0 p-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="drop-statements" className="text-sm">
                Include DROP statements
              </Label>
              <p className="text-xs text-muted-foreground">Add DROP TABLE IF EXISTS before CREATE</p>
            </div>
            <Switch
              id="drop-statements"
              checked={options.includeDropStatements}
              onCheckedChange={(checked) => setOptions({ ...options, includeDropStatements: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="indexes" className="text-sm">
                Include indexes
              </Label>
              <p className="text-xs text-muted-foreground">Create indexes for foreign keys</p>
            </div>
            <Switch
              id="indexes"
              checked={options.includeIndexes}
              onCheckedChange={(checked) => setOptions({ ...options, includeIndexes: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schema-name" className="text-sm">
              Schema name (optional)
            </Label>
            <Input
              id="schema-name"
              placeholder="public"
              value={options.schemaName}
              onChange={(e) => setOptions({ ...options, schemaName: e.target.value })}
              className="h-8"
            />
            <p className="text-xs text-muted-foreground">Leave empty to use default schema</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
