import { ChevronDown } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Schema } from "../types";

type Props = {
  schemas: Schema[];
  selectedSchema: Schema;
  onSchemaChange: (schema: Schema) => void;
};

export function SchemaSelector({ schemas, selectedSchema, onSchemaChange }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between h-8 bg-transparent border-sidebar-border/60 text-sidebar-foreground hover:bg-sidebar-accent hover:border-sidebar-border px-3"
        >
          <span className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground/70">schema:</span>
            <span className="text-sidebar-foreground">{selectedSchema.name}</span>
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground/70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
        {schemas.map((schema) => (
          <DropdownMenuItem
            key={schema.id}
            onClick={() => onSchemaChange(schema)}
            className="text-sm"
          >
            {schema.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
