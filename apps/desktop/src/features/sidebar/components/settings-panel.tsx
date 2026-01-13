import { Copy } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { Slider } from "@/shared/ui/slider";
import { Separator } from "@/shared/ui/separator";
import { useSettings } from "@/core/settings";

type Props = {
  onCopySchema?: () => void;
};

export function SettingsPanel({ onCopySchema }: Props) {
  const { settings, updateSetting } = useSettings();

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Editor Section */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Editor
        </h4>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-sidebar-foreground">Font size</span>
            <span className="text-sm font-mono text-sidebar-foreground">{settings.editorFontSize}px</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">A</span>
            <Slider
              value={[settings.editorFontSize]}
              onValueChange={([value]) => updateSetting("editorFontSize", value)}
              min={10}
              max={24}
              step={1}
            />
            <span className="text-base text-muted-foreground">A</span>
          </div>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Safety Section */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Safety
        </h4>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="text-sm text-sidebar-foreground">Confirm before delete</div>
            <div className="text-xs text-muted-foreground leading-tight">
              Show confirmation for destructive actions
            </div>
          </div>
          <div className="flex-shrink-0 pt-0.5">
            <Switch
              checked={settings.confirmBeforeDelete}
              onCheckedChange={(checked) => updateSetting("confirmBeforeDelete", checked)}
            />
          </div>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Startup
        </h4>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="text-sm text-sidebar-foreground">Restore last connection</div>
            <div className="text-xs text-muted-foreground leading-tight">
              Automatically reconnect to the last used database on startup
            </div>
          </div>
          <div className="flex-shrink-0 pt-0.5">
            <Switch
              checked={settings.restoreLastConnection}
              onCheckedChange={(checked) => updateSetting("restoreLastConnection", checked)}
            />
          </div>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Actions */}
      {onCopySchema && (
        <Button
          variant="outline"
          size="sm"
          className="justify-center gap-2 border-sidebar-border"
          onClick={onCopySchema}
        >
          <Copy className="h-4 w-4" />
          <span>Copy database schema</span>
        </Button>
      )}
    </div>
  );
}
