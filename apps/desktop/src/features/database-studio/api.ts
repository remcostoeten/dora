import type { ColumnDefinition, TableData } from "@/features/database-studio/types";
import { DatabaseSchema, StatementInfo, JsonValue } from "@/lib/bindings";

export function backendToColumnDefinition(col: {
	name: string
	data_type: string
	is_nullable: boolean
	is_primary_key: boolean
}): ColumnDefinition {
	return {
		name: col.name,
		type: col.data_type,
		nullable: col.is_nullable,
		primaryKey: col.is_primary_key
	}
}

// All previous exported functions are now replaced by DataAdapter
// Keeping this file for utility functions if needed in future, but marking as deprecated
