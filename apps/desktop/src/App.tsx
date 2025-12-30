import { useState } from 'react';
import { ConnectionManager } from '@/components/ConnectionManager';
import { QueryConsole } from '@/components/QueryConsole';
import { SnippetLibrary } from '@/components/SnippetLibrary';

function App() {
    const [connectionId, setConnectionId] = useState<string | null>(null);
    const [consoleSql, setConsoleSql] = useState<string>('');

    return (
        <div className="flex h-screen bg-neutral-900 text-white overflow-hidden font-sans">

            {/* Sidebar */}
            <div className="w-80 border-r border-neutral-700 flex flex-col">
                <div className="p-4 border-b border-neutral-800">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                        Dora
                    </h1>
                </div>

                <div className="flex-1 overflow-auto p-2 space-y-4">
                    <ConnectionManager
                        activeId={connectionId}
                        onConnect={setConnectionId}
                    />
                    <div className="h-px bg-neutral-800 my-2" />
                    <SnippetLibrary onSelect={sql => setConsoleSql(sql)} />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="h-12 border-b border-neutral-700 flex items-center px-4 justify-between bg-neutral-800/50">
                    <div className="flex items-center gap-2 text-sm text-neutral-400">
                        <span className={`w-2 h-2 rounded-full ${connectionId ? 'bg-green-500' : 'bg-neutral-600'}`} />
                        {connectionId ? `Connected` : 'Not connected'}
                    </div>
                </div>
                <div className="flex-1 p-4 overflow-hidden">
                    <QueryConsole activeConnectionId={connectionId} initialSql={consoleSql} />
                </div>
            </div>
        </div>
    );
}

export default App;
