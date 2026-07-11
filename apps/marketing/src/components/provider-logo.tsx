import { CornerTick } from '@/components/corner-tick'

const LOGO_BY_ID = {
    postgres: { src: '/providers/postgresql.svg', label: 'PostgreSQL' },
    sqlite: { src: '/providers/sqlite.svg', label: 'SQLite' },
    duckdb: { src: '/providers/duckdb.svg', label: 'DuckDB' },
    libsql: { src: '/providers/libsql.svg', label: 'libSQL' },
    mysql: { src: '/providers/mysql.svg', label: 'MySQL' },
    mariadb: { src: '/providers/mariadb.svg', label: 'MariaDB' },
    cockroach: { src: '/providers/cockroach.svg', label: 'CockroachDB' },
} as const

export type ProviderLogoId = keyof typeof LOGO_BY_ID

export function ProviderLogoMark({
    id,
    active,
}: {
    id: ProviderLogoId
    active: boolean
}) {
    const logo = LOGO_BY_ID[id]
    const tickOpacity = active ? 'opacity-100' : 'opacity-65'

    return (
        <div
            className={[
                'relative flex size-11 items-center justify-center border bg-surface-deeper/90 transition-colors duration-300 sm:size-12',
                active ? 'border-brand-200/35 bg-surface-deep' : 'border-line',
            ].join(' ')}
        >
            <CornerTick className={`-left-px -top-px -translate-x-1/2 -translate-y-1/2 ${tickOpacity}`} />
            <CornerTick className={`-right-px -top-px translate-x-1/2 -translate-y-1/2 ${tickOpacity}`} />
            <CornerTick className={`-bottom-px -left-px -translate-x-1/2 translate-y-1/2 ${tickOpacity}`} />
            <CornerTick className={`-bottom-px -right-px translate-x-1/2 translate-y-1/2 ${tickOpacity}`} />
            <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-px transition-opacity duration-300"
                style={{
                    backgroundColor: 'var(--color-brand-200)',
                    opacity: active ? 0.85 : 0.2,
                }}
            />
            <img
                src={logo.src}
                alt={`${logo.label} logo`}
                width={32}
                height={32}
                className="relative block size-7 transition-[filter] duration-300 sm:size-8"
                style={{
                    filter: active
                        ? 'grayscale(1) brightness(1.8)'
                        : 'grayscale(1) brightness(0.7)',
                }}
                draggable={false}
            />
        </div>
    )
}
