import { useMutation, useQueryClient } from "@tanstack/react-query";
import { seedDatabase } from "../container-service";

type SeedDatabaseOptions = {
    containerId: string
    filePath: string
    connectionConfig: {
        user: string
        database: string
    }
}

export function useSeedDatabase() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async function ({ containerId, filePath, connectionConfig }: SeedDatabaseOptions) {
            const result = await seedDatabase(containerId, filePath, connectionConfig)
            if (!result.success) {
                throw new Error(result.error)
            }
            return result
        },
        onSuccess: function () {
            // Invalidate logs or container stats if needed
            queryClient.invalidateQueries({ queryKey: ['docker-container-logs'] })
        }
    })
}
