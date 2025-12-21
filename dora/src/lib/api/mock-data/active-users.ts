import type { ActiveUserRecord } from "../types"
import { SeededRandom } from "../seeded-random"
import { generateUsers } from "./users"

export function generateActiveUsers(count = 89): ActiveUserRecord[] {
  const rng = new SeededRandom("dora-active-users-v1")
  const allUsers = generateUsers(1250)
  const activeUsers: ActiveUserRecord[] = []

  // Get users with 'active' status who have logged in
  const eligibleUsers = allUsers.filter((u) => u.status === "active" && u.lastLoginAt !== null)

  // Take a random sample
  const selectedIndices = new Set<number>()
  while (selectedIndices.size < Math.min(count, eligibleUsers.length)) {
    selectedIndices.add(rng.nextInt(0, eligibleUsers.length - 1))
  }

  const selectedUsers = Array.from(selectedIndices).map((i) => eligibleUsers[i])

  for (const user of selectedUsers) {
    activeUsers.push({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      lastLoginAt: user.lastLoginAt!,
      sessionCount: rng.nextInt(5, 150),
      totalOrders: rng.nextInt(1, 50),
      lifetimeValue: Math.round(rng.next() * 500000 + 10000) / 100, // $100-$5000
    })
  }

  return activeUsers.sort((a, b) => new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime())
}
