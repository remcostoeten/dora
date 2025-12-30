import { commands, type Result } from './bindings';

// Helper type to extract the success data from a Result Promise
type UnwrapResult<T> = T extends Promise<Result<infer D, any>> ? Promise<D> : never;

// Mapped type that converts every command function to return Promise<Data> instead of Promise<Result<Data, Error>>
type WrappedCommands = {
    [K in keyof typeof commands]: (...args: Parameters<typeof commands[K]>) => UnwrapResult<ReturnType<typeof commands[K]>>;
};

/**
 * A type-safe wrapper around the generated Tauri commands.
 * 
 * AUTOMATICALLY UNWRAPS RESULTS:
 * - If the command succeeds (status: "ok"), returns the data directly.
 * - If the command fails (status: "error"), throws the error.
 * 
 * Usage:
 * ```ts
 * import { api } from '$lib/api';
 * 
 * try {
 *   const connections = await api.getConnections();
 *   // connections is ConnectionInfo[], not Result<ConnectionInfo[], ...>
 * } catch (error) {
 *   // handle error
 * }
 * ```
 */
export const api = new Proxy(commands, {
    get(target, prop) {
        const key = prop as keyof typeof commands;
        const fn = target[key];

        if (typeof fn === 'function') {
            return async (...args: any[]) => {
                const result = await fn(...args as any);

                // Specta/Tauri Result handling
                if (result && typeof result === 'object' && 'status' in result) {
                    if (result.status === 'ok') {
                        return result.data;
                    } else if (result.status === 'error') {
                        // Throwing the error allows standard try/catch flow
                        throw result.error;
                    }
                }

                // Fallback for commands that might not return a Result (if any)
                return result;
            };
        }

        return fn;
    },
}) as WrappedCommands;
