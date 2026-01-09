import { cn } from "@/shared/utils/cn";

type Props = {
    className?: string;
};

export function PostgresIcon({ className }: Props) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={cn("h-6 w-6", className)}
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M12 2C9.5 2 7.5 3.5 6.5 5C5.5 3.5 3.5 3 2 4C3 5.5 3 7.5 3 9C3 14 6 19 10 21C10 21 11 22 12 22C13 22 14 21 14 21C18 19 21 14 21 9C21 7.5 21 5.5 22 4C20.5 3 18.5 3.5 17.5 5C16.5 3.5 14.5 2 12 2Z"
                className="fill-[#336791]"
            />
            <path
                d="M12 6C10 6 8.5 7.5 8.5 9.5C8.5 11.5 10 13 12 13C14 13 15.5 11.5 15.5 9.5C15.5 7.5 14 6 12 6Z"
                className="fill-white/90"
            />
            <path
                d="M10 15C9 15.5 8.5 16.5 9 17.5C9.5 18.5 10.5 19 11.5 18.5"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="opacity-80"
            />
        </svg>
    );
}

export function MySQLIcon({ className }: Props) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={cn("h-6 w-6", className)}
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M12 3C7 3 3 6 3 10V14C3 18 7 21 12 21C17 21 21 18 21 14V10C21 6 17 3 12 3Z"
                className="fill-[#00758F]"
            />
            <path
                d="M12 6C8.5 6 6 8 6 10.5C6 13 8.5 15 12 15C15.5 15 18 13 18 10.5C18 8 15.5 6 12 6Z"
                className="fill-[#F29111]"
            />
            <path
                d="M8 11L10 13L14 9"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function SQLiteIcon({ className }: Props) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={cn("h-6 w-6", className)}
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect
                x="4"
                y="2"
                width="16"
                height="20"
                rx="2"
                className="fill-[#0F3B5F]"
            />
            <path
                d="M7 6H17M7 10H17M7 14H13"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="opacity-60"
            />
            <circle cx="16" cy="17" r="3" className="fill-[#5AC8FA]" />
            <path
                d="M15 17L16 18L17.5 16"
                stroke="white"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function LibSQLIcon({ className }: Props) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={cn("h-6 w-6", className)}
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M12 2L3 7V17L12 22L21 17V7L12 2Z"
                className="fill-[#00D4AA]"
            />
            <path
                d="M12 2V22"
                stroke="white"
                strokeWidth="1.5"
                className="opacity-40"
            />
            <path
                d="M3 7L12 12L21 7"
                stroke="white"
                strokeWidth="1.5"
                className="opacity-40"
            />
            <circle cx="12" cy="12" r="3" className="fill-white/90" />
            <circle cx="12" cy="12" r="1.5" className="fill-[#00D4AA]" />
        </svg>
    );
}

type DatabaseType = "postgres" | "mysql" | "sqlite" | "libsql";

type DatabaseIconProps = {
    type: DatabaseType;
    className?: string;
};

export function DatabaseIcon({ type, className }: DatabaseIconProps) {
    switch (type) {
        case "postgres":
            return <PostgresIcon className={className} />;
        case "mysql":
            return <MySQLIcon className={className} />;
        case "sqlite":
            return <SQLiteIcon className={className} />;
        case "libsql":
            return <LibSQLIcon className={className} />;
        default:
            return <SQLiteIcon className={className} />;
    }
}

export const DATABASE_META: Record<DatabaseType, { name: string; description: string }> = {
    postgres: {
        name: "PostgreSQL",
        description: "Full-featured relational database",
    },
    mysql: {
        name: "MySQL",
        description: "Popular open-source RDBMS",
    },
    sqlite: {
        name: "SQLite",
        description: "Local file-based database",
    },
    libsql: {
        name: "LibSQL / Turso",
        description: "Edge-native SQLite fork",
    },
};
