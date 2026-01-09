import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { DataAdapter, DataProviderContextValue } from "./types";
import { createTauriAdapter } from "./adapters/tauri";
import { createMockAdapter } from "./adapters/mock";

function detectTauri(): boolean {
    return typeof window !== "undefined" && "__TAURI__" in window;
}

const DataProviderContext = createContext<DataProviderContextValue | null>(null);

type Props = {
    children: ReactNode;
    forceMock?: boolean;
};

export function DataProvider({ children, forceMock = false }: Props) {
    const [isReady, setIsReady] = useState(false);
    const [adapter, setAdapter] = useState<DataAdapter | null>(null);
    const isTauri = !forceMock && detectTauri();

    useEffect(function () {
        if (isTauri) {
            setAdapter(createTauriAdapter());
        } else {
            setAdapter(createMockAdapter());
        }
        setIsReady(true);
    }, [isTauri]);

    if (!isReady || !adapter) {
        return null;
    }

    const value: DataProviderContextValue = {
        adapter,
        isTauri,
        isReady,
    };

    return (
        <DataProviderContext.Provider value={value}>
            {children}
        </DataProviderContext.Provider>
    );
}

export function useDataProvider(): DataProviderContextValue {
    const context = useContext(DataProviderContext);
    if (!context) {
        throw new Error("useDataProvider must be used within a DataProvider");
    }
    return context;
}

export function useAdapter(): DataAdapter {
    const { adapter } = useDataProvider();
    return adapter;
}

export function useIsTauri(): boolean {
    const { isTauri } = useDataProvider();
    return isTauri;
}
