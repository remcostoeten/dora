import { cn } from "@/shared/utils/cn";
import { Sqlite, Turso, Postgres, Sql } from "@/components/provider.icons";
import type { DatabaseType } from "../types";

type Props = {
    type: DatabaseType | undefined;
    className?: string;
    withColor?: boolean;
};

export function DatabaseTypeIcon({ type, className, withColor = true }: Props) {
    const baseClass = cn("shrink-0", className);

    if (!type) {
        return <Sql className={baseClass} />;
    }

    switch (type.toLowerCase()) {
        case "postgres":
        case "postgresql":
            return <Postgres className={baseClass} />;

        case "sqlite":
            return <Sqlite className={baseClass} />;

        case "libsql":
        case "turso":
            return <Turso className={baseClass} />;

        case "mysql":
            return <Sql className={baseClass} />;

        default:
            return <Sql className={baseClass} />;
    }
}
