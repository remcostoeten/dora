import { useState, useRef, useEffect } from "react";
import { Input } from "@/shared/ui/input";

type Props = {
  value: unknown;
  draftValue: string | null;
  isEditing: boolean;
  onEdit: (value: string) => void;
  onFinishEdit: () => void;
};

export function EditableCell({ value, draftValue, isEditing, onEdit, onFinishEdit }: Props) {
  const [localValue, setLocalValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = draftValue !== null ? draftValue : String(value ?? "");
  const hasDraft = draftValue !== null;

  useEffect(() => {
    if (isEditing) {
      setLocalValue(displayValue);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
    }
  }, [isEditing, displayValue]);

  function handleBlur() {
    if (localValue !== String(value ?? "")) {
      onEdit(localValue);
    }
    onFinishEdit();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      if (localValue !== String(value ?? "")) {
        onEdit(localValue);
      }
      onFinishEdit();
    } else if (e.key === "Escape") {
      setLocalValue(displayValue);
      onFinishEdit();
    }
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-7 rounded-none border-primary bg-background px-2 font-mono text-xs"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center overflow-hidden">
      <span
        className={`truncate font-mono text-xs ${
          hasDraft ? "text-warning" : value === null ? "text-muted-foreground" : ""
        }`}
      >
        {value === null ? "NULL" : displayValue}
      </span>
      {hasDraft && <span className="ml-1 shrink-0 text-warning">•</span>}
    </div>
  );
}