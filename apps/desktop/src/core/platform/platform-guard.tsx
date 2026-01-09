import { ReactNode } from "react";
import { useIsTauri } from "../data-provider/context";

type Props = {
    children: ReactNode;
};

function TauriGuard({ children }: Props) {
    const isTauri = useIsTauri();
    return isTauri ? <>{children}</> : null;
}

function WebGuard({ children }: Props) {
    const isTauri = useIsTauri();
    return !isTauri ? <>{children}</> : null;
}

export const Platform = {
    Tauri: TauriGuard,
    Web: WebGuard,
};
