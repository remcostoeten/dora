import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { Slider } from "@/shared/ui/slider";
import { cn } from "@/shared/utils/cn";

type PaginationType = "LIMIT OFFSET" | "PAGES";
type ByteaFormat = "HEX" | "UTF8";

type SettingsState = {
  tableRowsCount: boolean;
  expandSubviews: boolean;
  paginationType: PaginationType;
  flatSchemas: boolean;
  byteaFormat: ByteaFormat;
  editorFontSize: number;
  editorKeybindings: string;
};

type Props = {
  settings: SettingsState;
  onSettingsChange: (settings: SettingsState) => void;
  onCopySchema: () => void;
};

export function SettingsPanel({ settings, onSettingsChange, onCopySchema }: Props) {
  function handleChange<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    onSettingsChange({ ...settings, [key]: value });
  }

  return (
    <div className="flex flex-col gap-4 p-4 border-t border-sidebar-border">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm text-sidebar-foreground">Table rows count</div>
          <div className="text-xs text-muted-foreground">
            Beware count(*) operation performs light scan of the table which can be both slow and billed by serverless databases for row reads
          </div>
        </div>
        <Switch
          checked={settings.tableRowsCount}
          onCheckedChange={(checked) => handleChange("tableRowsCount", checked)}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm text-sidebar-foreground">Expand subviews</div>
          <div className="text-xs text-muted-foreground">
            Always keep subviews visible
          </div>
        </div>
        <Switch
          checked={settings.expandSubviews}
          onCheckedChange={(checked) => handleChange("expandSubviews", checked)}
        />
      </div>

      <div>
        <div className="text-sm text-sidebar-foreground mb-2">Pagination type</div>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-sm text-sidebar-foreground cursor-pointer">
            <input
              type="radio"
              name="paginationType"
              checked={settings.paginationType === "LIMIT OFFSET"}
              onChange={() => handleChange("paginationType", "LIMIT OFFSET")}
              className="accent-primary"
            />
            LIMIT OFFSET
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="radio"
              name="paginationType"
              checked={settings.paginationType === "PAGES"}
              onChange={() => handleChange("paginationType", "PAGES")}
              className="accent-primary"
            />
            PAGES
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm text-sidebar-foreground">Flat schemas</div>
          <div className="text-xs text-muted-foreground">
            Show tables without grouping by schema
          </div>
        </div>
        <Switch
          checked={settings.flatSchemas}
          onCheckedChange={(checked) => handleChange("flatSchemas", checked)}
        />
      </div>

      <div>
        <div className="text-sm text-sidebar-foreground mb-2">Show bytea as</div>
        <div className="flex gap-2">
          <Button
            variant={settings.byteaFormat === "HEX" ? "secondary" : "ghost"}
            size="sm"
            className="font-mono text-xs"
            onClick={() => handleChange("byteaFormat", "HEX")}
          >
            \x69643A3130303031
          </Button>
          <Button
            variant={settings.byteaFormat === "UTF8" ? "secondary" : "ghost"}
            size="sm"
            className="font-mono text-xs"
            onClick={() => handleChange("byteaFormat", "UTF8")}
          >
            id:10001
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-sidebar-foreground">Editor font size:</span>
          <span className="text-sm text-sidebar-foreground">{settings.editorFontSize}px</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">A</span>
          <Slider
            value={[settings.editorFontSize]}
            onValueChange={([value]) => handleChange("editorFontSize", value)}
            min={10}
            max={24}
            step={1}
            className="flex-1"
          />
          <span className="text-base text-muted-foreground">A</span>
        </div>
      </div>

      <div>
        <div className="text-sm text-sidebar-foreground mb-1">Editor keybindings</div>
        <div className="text-sm text-muted-foreground">{settings.editorKeybindings}</div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="justify-center gap-2 border-sidebar-border"
        onClick={onCopySchema}
      >
        <span>Copy database schema</span>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export type { SettingsState, PaginationType, ByteaFormat };
