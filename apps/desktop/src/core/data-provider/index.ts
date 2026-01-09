export { DataProvider, useDataProvider, useAdapter, useIsTauri } from "./context";
export { createTauriAdapter } from "./adapters/tauri";
export { createMockAdapter, resetMockStore } from "./adapters/mock";
export type { DataAdapter, AdapterResult, QueryResult, DataProviderContextValue } from "./types";
