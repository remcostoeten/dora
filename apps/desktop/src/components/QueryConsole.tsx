import { useState, useEffect } from 'react';
import { useQuery } from '@/hooks/useQuery';
import { useSnippets } from '@/hooks/useSnippets';

interface Props {
    activeConnectionId: string | null;
    initialSql?: string;
}

export function QueryConsole({ activeConnectionId, initialSql }: Props) {
    const [sql, setSql] = useState('SELECT * FROM users LIMIT 10;'); // Default placeholder
    const { runQuery, results, columns, isRunning, error, executionTime } = useQuery(activeConnectionId);
    const { saveSnippet } = useSnippets();

    useEffect(() => {
        if (initialSql) setSql(initialSql);
    }, [initialSql]);

    const [showSave, setShowSave] = useState(false);
    const [snippetName, setSnippetName] = useState('');
    const [snippetCategory, setSnippetCategory] = useState('');

    const handleRun = () => {
        runQuery(sql);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!snippetName) return;
        try {
            await saveSnippet(snippetName, sql, 'sql', 'custom', snippetCategory || 'General');
            setShowSave(false);
            setSnippetName('');
        } catch (e) {
            alert("Failed to save struct");
        }
    };

    return (
        <div className="flex flex-col h-full bg-neutral-800 rounded-lg border border-neutral-700 overflow-hidden">
            <div className="p-2 bg-neutral-900 border-b border-neutral-700 flex justify-between items-center">
                <h2 className="font-bold text-sm text-neutral-400">Query Console</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSave(!showSave)}
                        className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded"
                    >
                        Save as Snippet
                    </button>
                    <button
                        onClick={handleRun}
                        disabled={!activeConnectionId || isRunning}
                        className={`px-4 py-1 text-xs font-bold rounded flex items-center gap-2 ${!activeConnectionId ? 'bg-neutral-700 cursor-not-allowed opacity-50' :
                            isRunning ? 'bg-yellow-600' : 'bg-green-600 hover:bg-green-500'
                            }`}
                    >
                        {isRunning ? 'Running...' : 'Run Query'} <span>▶</span>
                    </button>
                </div>
            </div>

            {showSave && (
                <form onSubmit={handleSave} className="p-3 bg-neutral-800 border-b border-neutral-700 flex gap-2 items-end">
                    <div className="flex-1">
                        <label className="text-xs block mb-1">Snippet Name</label>
                        <input className="w-full bg-neutral-900 border border-neutral-600 rounded px-2 py-1 text-sm"
                            value={snippetName} onChange={e => setSnippetName(e.target.value)} autoFocus required />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs block mb-1">Category</label>
                        <input className="w-full bg-neutral-900 border border-neutral-600 rounded px-2 py-1 text-sm"
                            value={snippetCategory} onChange={e => setSnippetCategory(e.target.value)} placeholder="e.g. Reports" />
                    </div>
                    <button type="submit" className="px-3 py-1 bg-blue-600 text-sm rounded h-[30px]">Save</button>
                </form>
            )}

            <div className="h-1/3 border-b border-neutral-700">
                <textarea
                    className="w-full h-full bg-[#1e1e1e] text-neutral-200 p-4 font-mono text-sm resize-none focus:outline-none"
                    value={sql}
                    onChange={e => setSql(e.target.value)}
                    placeholder="-- Enter SQL query here..."
                />
            </div>

            <div className="flex-1 overflow-auto bg-[#1e1e1e] relative">
                {error && (
                    <div className="p-4 text-red-500 font-mono text-sm">
                        Error: {error}
                    </div>
                )}

                {!error && results.length > 0 && (
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-neutral-800 text-neutral-400 text-xs uppercase font-semibold">
                            <tr>
                                {columns.map(col => (
                                    <th key={col} className="p-3 border-b border-neutral-700 whitespace-nowrap">{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-sm font-mono text-neutral-300 divide-y divide-neutral-800">
                            {results.map((row, i) => (
                                <tr key={i} className="hover:bg-neutral-800/50">
                                    {columns.map(col => (
                                        <td key={`${i}-${col}`} className="p-3 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                                            {row[col] === null ? <span className="text-neutral-600">NULL</span> : String(row[col])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!error && results.length === 0 && !isRunning && (
                    <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
                        No results to display
                    </div>
                )}
            </div>

            {executionTime !== null && (
                <div className="bg-neutral-900 text-xs text-neutral-500 px-3 py-1 border-t border-neutral-700 text-right">
                    {results.length} rows in {executionTime.toFixed(2)}ms
                </div>
            )}
        </div>
    );
}
