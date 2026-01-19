export { DockerView } from "./components/docker-view";
export { SandboxIndicator } from "./components/sandbox-indicator";
export { StatusBadge } from "./components/status-badge";

export { useContainers, useDockerAvailability } from "./api/queries/use-containers";
export { useContainerLogs } from "./api/queries/use-container-logs";
export { useContainerHealth, useContainer } from "./api/queries/use-container-health";
export { useCreateContainer } from "./api/mutations/use-create-container";
export { useContainerActions, useRemoveContainer } from "./api/mutations/use-container-actions";

export { validateConnectionTarget, isLocalHost, isManagedContainer } from "./utilities/safety-validator";
export { buildConnectionEnvVars, formatEnvVarsForClipboard } from "./utilities/connection-string-builder";
export { validateContainerName, suggestContainerName, isManaged } from "./utilities/container-naming";

export { CONTAINER_PREFIX, POSTGRES_VERSIONS, GENERATOR_PROFILES, GENERATOR_SCALES } from "./constants";

export type {
    DockerContainer,
    PostgresContainerConfig,
    ContainerState,
    ContainerHealth,
    ContainerOrigin,
    SeedStrategy,
    SeedProgress,
    AllowedConnection,
    DockerFeatureState,
} from "./types";
