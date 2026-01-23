import type { DockerContainer } from "../types";

export function generateDockerCompose(container: DockerContainer): string {
    const serviceName = container.name || 'postgres';
    const image = `${container.image}:${container.imageTag}`;

    // Filter out internal env vars if any (e.g. self-managed ones)
    // For now we include all, but formatted as object or list
    const envVars = container.env.reduce((acc, env) => {
        const [key, value] = env.split('=');
        // Filter out empty keys
        if (key) {
            acc[key] = value || '';
        }
        return acc;
    }, {} as Record<string, string>);

    const ports = container.ports.map(p => `"${p.hostPort}:${p.containerPort}"`);

    // Construct the YAML string manually to avoid heavy dependencies like 'js-yaml' for this simple use case
    // We use 2-space indentation

    let yaml = `version: '3.8'

services:
  ${serviceName}:
    image: ${image}
    container_name: ${container.name}
    restart: unless-stopped`;

    // Ports
    if (ports.length > 0) {
        yaml += `\n    ports:`;
        ports.forEach(p => {
            yaml += `\n      - ${p}`;
        });
    }

    // Environment
    const envKeys = Object.keys(envVars);
    if (envKeys.length > 0) {
        yaml += `\n    environment:`;
        envKeys.forEach(key => {
            yaml += `\n      ${key}: ${envVars[key]}`;
        });
    }

    // Volumes (Managed container usually sends data to /var/lib/postgresql/data)
    // If it's a managed container, we likely used a named volume
    // We can try to infer or just add a standard volume for persistence if it's a DB
    if (container.image.includes('postgres')) {
        yaml += `\n    volumes:`;
        yaml += `\n      - ${container.name}-data:/var/lib/postgresql/data`;
    }

    // Add volumes section at the bottom if we used any named volumes
    if (container.image.includes('postgres')) {
        yaml += `\n\nvolumes:
  ${container.name}-data:`;
    }

    return yaml;
}
