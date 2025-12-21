import type { UserRecord } from "../types"
import { SeededRandom } from "../seeded-random"

const FIRST_NAMES = [
  "James",
  "Mary",
  "John",
  "Patricia",
  "Robert",
  "Jennifer",
  "Michael",
  "Linda",
  "William",
  "Barbara",
  "David",
  "Elizabeth",
  "Richard",
  "Susan",
  "Joseph",
  "Jessica",
  "Thomas",
  "Sarah",
  "Christopher",
  "Karen",
]

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
]

const STATUSES: ("active" | "inactive" | "pending")[] = ["active", "inactive", "pending"]
const TIERS: ("free" | "pro" | "enterprise" | null)[] = ["free", "pro", "enterprise", null]

export function generateUsers(count = 1250): UserRecord[] {
  const rng = new SeededRandom("dora-users-v1")
  const users: UserRecord[] = []

  const startDate = new Date("2020-01-01")
  const endDate = new Date("2024-12-01")

  for (let i = 0; i < count; i++) {
    const firstName = rng.choice(FIRST_NAMES)
    const lastName = rng.choice(LAST_NAMES)
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}@example.com`
    const createdAt = rng.date(startDate, endDate)
    const hasLoggedIn = rng.nextBoolean(0.7) // 70% have logged in

    users.push({
      id: i + 1,
      email,
      firstName: rng.nextBoolean(0.9) ? firstName : null, // 90% have first name
      lastName: rng.nextBoolean(0.85) ? lastName : null, // 85% have last name
      status: rng.choice(STATUSES),
      subscriptionTier: rng.choice(TIERS),
      lastLoginAt: hasLoggedIn ? rng.date(createdAt, endDate).toISOString() : null,
      createdAt: createdAt.toISOString(),
      updatedAt: rng.date(createdAt, endDate).toISOString(),
    })
  }

  return users
}
