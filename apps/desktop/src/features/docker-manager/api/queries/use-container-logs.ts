import { useQuery } from "@tanstack/react-query";
import { getContainerLogs } from "../container-service";
import type { ContainerLogsOptions } from "../../types";
import { DEFAULT_LOG_TAIL } from "../../constants";

type UseContainerLogsOptions = ContainerLogsOptions & {
    enabled?: boolean;
    refetchInterval?: number;
};

export function useContainerLogs(
    containerId: string | null,
    options: UseContainerLogsOptions = {}
) {
    const {
        tail = DEFAULT_LOG_TAIL,
        since,
        enabled = true,
        refetchInterval = 5000,
    } = options;

    return useQuery<string, Error>({
        queryKey: ["docker-container-logs", containerId, { tail, since }],
        queryFn: function () {
            if (!containerId) {
                return Promise.resolve("");
            }
            return getContainerLogs(containerId, { tail, since });
        },
        enabled: enabled && Boolean(containerId),
        refetchInterval,
        staleTime: 2000,
    });
}
