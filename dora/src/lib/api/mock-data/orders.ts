import type { OrderRecord } from "../types"
import { SeededRandom } from "../seeded-random"

const STATUSES: ("pending" | "processing" | "shipped" | "delivered" | "cancelled")[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]

const CURRENCIES = ["USD", "EUR", "GBP", "CAD"]

const ADDRESSES = [
  "123 Main St, New York, NY 10001",
  "456 Oak Ave, Los Angeles, CA 90001",
  "789 Pine Rd, Chicago, IL 60601",
  "321 Elm St, Houston, TX 77001",
  "654 Maple Dr, Phoenix, AZ 85001",
  null, // Some orders have no shipping address yet
]

export function generateOrders(count = 5432, maxUserId = 1250): OrderRecord[] {
  const rng = new SeededRandom("dora-orders-v1")
  const orders: OrderRecord[] = []

  const startDate = new Date("2022-01-01")
  const endDate = new Date("2024-12-20")

  for (let i = 0; i < count; i++) {
    const userId = rng.nextInt(1, maxUserId)
    const orderNumber = `ORD-${String(i + 1).padStart(8, "0")}`
    const status = rng.choice(STATUSES)
    const orderDate = rng.date(startDate, endDate)

    let shippedDate: string | null = null
    let deliveredDate: string | null = null

    if (status === "shipped" || status === "delivered") {
      const shippedDateObj = new Date(orderDate.getTime() + rng.nextInt(1, 7) * 24 * 60 * 60 * 1000)
      shippedDate = shippedDateObj.toISOString()

      if (status === "delivered") {
        const deliveredDateObj = new Date(shippedDateObj.getTime() + rng.nextInt(2, 10) * 24 * 60 * 60 * 1000)
        deliveredDate = deliveredDateObj.toISOString()
      }
    }

    orders.push({
      id: i + 1,
      userId,
      orderNumber,
      status,
      totalAmount: Math.round(rng.next() * 50000 + 1000) / 100, // $10-$500
      currency: rng.choice(CURRENCIES),
      shippingAddress: rng.choice(ADDRESSES),
      orderDate: orderDate.toISOString(),
      shippedDate,
      deliveredDate,
    })
  }

  return orders
}
