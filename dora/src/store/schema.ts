import { create } from "zustand"
import type { ColMeta, SchemaData } from "@/shared/types"

type SchemaState = {
  schemas: Record<string, SchemaData>
  loading: boolean
  fetchSchema: (table: string) => Promise<void>
  getColMeta: (table: string, column: string) => ColMeta | null
}

export const useSchema = create<SchemaState>((set, get) => ({
  schemas: {},
  loading: false,

  fetchSchema: async (table) => {
    set({ loading: true })
    // TODO: Replace with actual API call
    const mockSchema: SchemaData = {
      tableName: table,
      columns: [
        {
          name: "id",
          type: "int4",
          cellType: "number",
          isPrimary: true,
          isNullable: false,
        },
        {
          name: "role",
          type: "varchar",
          cellType: "enum",
          isPrimary: false,
          isNullable: false,
          constraints: {
            enum: ["admin", "user", "viewer"],
            required: true,
          },
        },
        {
          name: "is_active",
          type: "bool",
          cellType: "boolean",
          isPrimary: false,
          isNullable: false,
          defaultValue: true,
        },
        {
          name: "email",
          type: "varchar",
          cellType: "text",
          isPrimary: false,
          isNullable: false,
          constraints: {
            required: true,
            pattern: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$",
          },
        },
      ],
      indexes: [],
      foreignKeys: [],
    }

    set((state) => ({
      schemas: { ...state.schemas, [table]: mockSchema },
      loading: false,
    }))
  },

  getColMeta: (table, column) => {
    const schema = get().schemas[table]
    return schema?.columns.find((c) => c.name === column) || null
  },
}))
