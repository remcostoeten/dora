import { useSnippets } from '@/hooks/useSnippets';

export function SnippetLibrary({ onSelect }: { onSelect: (sql: string) => void }) {
    const { snippets, isLoading, error, fetchSnippets } = useSnippets();

    return (
        <div className="p-4 bg-neutral-800 rounded-lg border border-neutral-700 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Snippets</h2>
                <button onClick={() => fetchSnippets()} className="text-xs text-neutral-400 hover:text-white">Refresh</button>
            </div>

            {error && <div className="text-red-400 mb-2 text-xs">{error}</div>}

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {snippets.map(s => (
                    <div key={s.id} className="p-3 bg-neutral-900 border border-neutral-800 rounded hover:border-neutral-600 group">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="font-medium text-sm text-blue-400">{s.name}</h3>
                                {s.description && <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{s.description}</p>}
                            </div>
                            {s.is_system && <span className="text-[10px] bg-neutral-700 px-1.5 py-0.5 rounded text-neutral-300">System</span>}
                        </div>

                        <div className="flex gap-2 mb-2 flex-wrap">
                            {s.category && <span className="text-[10px] bg-purple-900/40 text-purple-300 px-1.5 rounded">{s.category}</span>}
                            {s.tags && s.tags.split(',').map(t => (
                                <span key={t} className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 rounded">{t.trim()}</span>
                            ))}
                        </div>

                        <div className="flex gap-2 mt-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => onSelect(s.query_text)}
                                className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-xs py-1 rounded"
                            >
                                Paste
                            </button>
                            {/* Could add Run button here too */}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
