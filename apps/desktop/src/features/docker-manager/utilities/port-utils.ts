import { DEFAULT_HOST_PORT_START, DEFAULT_HOST_PORT_END } from "../constants";

export async function findFreePort(
    preferredPort?: number,
    startPort: number = DEFAULT_HOST_PORT_START,
    endPort: number = DEFAULT_HOST_PORT_END
): Promise<number> {
    if (preferredPort && await isPortAvailable(preferredPort)) {
        return preferredPort;
    }

    for (let port = startPort; port <= endPort; port++) {
        if (await isPortAvailable(port)) {
            return port;
        }
    }

    throw new Error(`No available ports found in range ${startPort}-${endPort}`);
}

export async function isPortAvailable(port: number): Promise<boolean> {
    try {
        const response = await fetch(`http://localhost:${port}`, {
            method: "HEAD",
            signal: AbortSignal.timeout(100),
        });
        return false;
    } catch (error) {
        if (error instanceof TypeError && error.message.includes("fetch")) {
            return true;
        }
        if (error instanceof DOMException && error.name === "AbortError") {
            return true;
        }
        return true;
    }
}

export function formatPortMapping(hostPort: number, containerPort: number): string {
    return `${hostPort}:${containerPort}`;
}

export function parsePortMapping(mapping: string): { hostPort: number; containerPort: number } | null {
    const parts = mapping.split(":");
    if (parts.length !== 2) {
        return null;
    }

    const hostPort = parseInt(parts[0], 10);
    const containerPort = parseInt(parts[1], 10);

    if (isNaN(hostPort) || isNaN(containerPort)) {
        return null;
    }

    return { hostPort, containerPort };
}

export function isValidPort(port: number): boolean {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function isPrivilegedPort(port: number): boolean {
    return port < 1024;
}

export function getPortRange(): { start: number; end: number } {
    return {
        start: DEFAULT_HOST_PORT_START,
        end: DEFAULT_HOST_PORT_END,
    };
}
