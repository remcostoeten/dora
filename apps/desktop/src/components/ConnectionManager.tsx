import { useState } from 'react';
import { useConnections } from '@/hooks/useConnections';
import { DatabaseInfo } from '@/lib/bindings';

interface Props {
    activeId: string | null;
    onConnect: (id: string) => void;
}

export function ConnectionManager({ activeId, onConnect }: Props) {
    const { connections, connect, createConnection, isLoading, error } = useConnections();
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<'sqlite' | 'postgres'>('sqlite');
    const [newPath, setNewPath] = useState('');

    const handleConnect = async (id: string) => {
        await connect(id);
        onConnect(id);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();

        let info: any; // Using any to bypass detailed type construction for demo
        if (newType === 'sqlite') {
            info = { type: 'Sqlite', path: newPath };
            // Note: Actual binding might expect { Sqlite: { path: ... } } or similar based on tagged enum
            // Checking bindings.ts type definition would be ideal, assuming standard flattening or default serde
        } else {
            // minimally for postgres
            info = { type: 'Postgres', url: newPath, name: "pg" }; // simplified
        }

        // Adjusting for likely Rust enum serialization (e.g. { "Sqlite": { "path": "..." } })
        // The bindings.ts type DatabaseInfo = { Sqlite: { path: string } } | { Postgres: { ... } }
        const dbInfo: DatabaseInfo = newType === 'sqlite'
            ? { Sqlite: { path: newPath } }
            : { Postgres: { url: newPath, name: newName, ssl: false, tunnel: null, ssh_config: null } };

        await createConnection(newName, dbInfo);
        setIsCreating(false);
        setNewName('');
        setNewPath('');
    };

    return (
        <div className="p-4 bg-neutral-800 rounded-lg border border-neutral-700">
            <h2 className="text-xl font-bold mb-4 flex justify-between items-center">
                <span>Connections</span>
                <button
                    onClick={() => setIsCreating(!isCreating)}
                    className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 rounded"
                >
                    {isCreating ? 'Cancel' : 'New'}
                </button>
            </h2>

            {error && <div className="text-red-400 mb-4 text-sm">{error}</div>}

            {isCreating && (
                <form onSubmit={handleCreate} className="mb-6 p-4 bg-neutral-900 rounded border border-neutral-700 space-y-3">
                    <div>
                        <label className="block text-xs text-neutral-400 mb-1">Name</label>
                        <input
                            className="w-full bg-neutral-800 border border-neutral-600 rounded px-2 py-1"
                            value={newName} onChange={e => setNewName(e.target.value)} required
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-neutral-400 mb-1">Type</label>
                        <select
                            className="w-full bg-neutral-800 border border-neutral-600 rounded px-2 py-1"
                            value={newType} onChange={e => setNewType(e.target.value as any)}
                        >
                            <option value="sqlite">SQLite</option>
                            <option value="postgres">PostgreSQL</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-neutral-400 mb-1">{newType === 'sqlite' ? 'File Path' : 'Connection URL'}</label>
                        <input
                            className="w-full bg-neutral-800 border border-neutral-600 rounded px-2 py-1"
                            value={newPath} onChange={e => setNewPath(e.target.value)} required
                        />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-green-600 hover:bg-green-500 py-1.5 rounded">
                        Create Connection
                    </button>
                </form>
            )}

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {connections.map(c => (
                    <div
                        key={c.id}
                        className={`p-3 rounded border cursor-pointer transition-colors flex justify-between items-center ${activeId === c.id
                            ? 'bg-blue-900/30 border-blue-500'
                            : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'
                            } `}
                        onClick={() => handleConnect(c.id)}
                    >
                        <div>
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-neutral-500">{JSON.stringify(c.databaseInfo).slice(0, 30)}...</div>
                        </div>
                        {activeId === c.id && <span className="text-xs bg-blue-500 px-2 py-1 rounded">Active</span>}
                    </div>
                ))}
                {connections.length === 0 && !isLoading && (
                    <div className="text-center text-neutral-500 text-sm py-4">No connections found</div>
                )}
            </div>
        </div>
    );
}
