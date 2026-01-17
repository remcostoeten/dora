import { cn } from "@/shared/utils/cn";
import type { DatabaseType } from "../types";

type Props = {
    type: DatabaseType | undefined;
    className?: string;
    withColor?: boolean;
};

export function DatabaseTypeIcon({ type, className, withColor = true }: Props) {
    const baseClass = cn("shrink-0", className);

    if (!type) {
        return (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                className={baseClass}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
        );
    }

    switch (type.toLowerCase()) {
        case "postgres":
        case "postgresql":
            return (
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className={baseClass}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"
                        fill={withColor ? "#336791" : "currentColor"}
                        fillOpacity={withColor ? 1 : 0.8}
                    />
                    {/* Simplified Elephant-ish shape or representative icon */}
                    <path
                        d="M12.9 6.5C15.1 6.5 17 8.3 17 10.7c0 2.4-1.9 4.2-4.1 4.2H8v-4c0-.5.2-1.3.6-1.9.9-1.5 2.5-2.5 4.3-2.5zM8 12.5v2.6c0 1 .8 1.9 1.9 1.9h2c1.1 0 1.9-.8 1.9-1.9v-.7c0-.9-.5-1.7-1.3-2.2-.6-.3-1.3-.5-2.1-.5H9.5c-.8 0-1.5.8-1.5 1.7z"
                        fill={withColor ? "#336791" : "currentColor"}
                    />
                </svg>
            );

        case "sqlite":
            return (
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className={baseClass}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* Feather-like shape for SQLite */}
                    <path
                        d="M19.33 10.38c-.28-1.55-1.12-2.94-2.39-3.95-1.27-1.01-2.88-1.55-4.54-1.48-1.66.07-3.23.71-4.42 1.83-1.19 1.12-1.93 2.65-2.07 4.27-.19 2.15.58 4.24 2.1 5.76C9.53 18.33 11.62 19.1 13.77 18.9c1.62-.14 3.15-.88 4.27-2.07 1.12-1.19 1.76-2.76 1.83-4.42.02-.34.02-.68.01-1.02l.02-.01c.21-.19.46-.35.73-.47.67-.29 1.45-.14 2.01.37.56.51.76 1.3.52 1.99-.24.69-.85 1.16-1.57 1.25-.09.01-.18.01-.27 0"
                        stroke={withColor ? "#003B57" : "currentColor"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M5.9 8.9l-.8-.8c-1.17-1.17-1.17-3.07 0-4.24 1.17-1.17 3.07-1.17 4.24 0l.8.8"
                        stroke={withColor ? "#003B57" : "currentColor"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                </svg>
            );

        case "libsql":
        case "turso":
            return (
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className={baseClass}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* Turso/libSQL logo concept */}
                    <circle cx="12" cy="12" r="9" stroke={withColor ? "#40E0D0" : "currentColor"} strokeWidth="1.5" />
                    <path d="M12 7v10M7 12h10" stroke={withColor ? "#40E0D0" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="3" fill={withColor ? "#40E0D0" : "currentColor"} fillOpacity="0.2" />
                </svg>
            );

        case "mysql":
            return (
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className={baseClass}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* Dolphin-ish abstract or M */}
                    <path
                        d="M2 13.3c.7-3.5 3.3-6.4 6.7-7.5 1.5-.5 3.1-.7 4.7-.5 2 .2 3.9.9 5.6 2.1l1.8 1.2c.4.3.7.6.9 1 .4.7.5 1.5.3 2.3-.3 1.1-1.2 2-2.3 2.3-1.1.3-2.3 0-3.2-.7l-1.6-1.2c-.8-.6-1.8-.8-2.8-.7-.9.2-1.7.8-2.2 1.6-.4.7-.5 1.6-.2 2.4"
                        stroke={withColor ? "#F29111" : "currentColor"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                    <path
                        d="M16.5 13.5c-.3 1.5-1.6 2.5-3.1 2.5-1.2 0-2.3-.8-2.7-1.9"
                        stroke={withColor ? "#00758F" : "currentColor"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                </svg>
            );

        default:
            return (
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className={baseClass}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
            );
    }
}
