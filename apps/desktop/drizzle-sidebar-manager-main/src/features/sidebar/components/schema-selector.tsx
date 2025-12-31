import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSchemas = schemas.filter((schema) =>
    schema.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <DropdownMenuContent
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] p-0"
      >
        <div className="flex items-center px-3 py-2 border-b border-sidebar-border/50 sticky top-0 bg-popover z-10">
          <Search className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
          <input
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/70 min-w-0"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            autoFocus
          />
        </div>
        <div className="max-h-[240px] overflow-y-auto p-1">
          {filteredSchemas.length > 0 ? (
            filteredSchemas.map((schema) => (
              <DropdownMenuItem
                key={schema.id}
                onClick={() => {
                  onSchemaChange(schema);
                  setSearchQuery("");
                }}
                className="text-sm"
              >
                {schema.name}
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground text-center">
              No schemas found
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
