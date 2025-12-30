import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { SavedQuery } from '@/lib/bindings';

export function useSnippets() {
    const [snippets, setSnippets] = useState<SavedQuery[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSnippets = useCallback(async (
        langFilter: string | null = null,
        sysFilter: boolean | null = null,
        catFilter: string | null = null
    ) => {
        try {
            setIsLoading(true);
            const data = await api.getSnippets(langFilter, sysFilter, catFilter);
            setSnippets(data);
            setError(null);
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setIsLoading(false);
        }
    }, []);

    const saveSnippet = useCallback(async (
        name: string,
        content: string,
        language: string,
        tags: string,
        category: string
    ) => {
        try {
            await api.saveSnippet(name, content, language, tags, category, null, null);
            await fetchSnippets(); // Refresh list
        } catch (err: any) {
            setError(`Failed to save: ${err.toString()}`);
            throw err;
        }
    }, [fetchSnippets]);

    // Initial load
    useEffect(() => {
        fetchSnippets();
    }, [fetchSnippets]);

    return {
        snippets,
        isLoading,
        error,
        fetchSnippets,
        saveSnippet
    };
}
