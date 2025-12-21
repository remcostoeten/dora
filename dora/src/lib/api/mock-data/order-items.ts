import type { OrderItemRecord } from "../types"
import { SeededRandom } from "../seeded-random"

const PRODUCT_NAMES = [
  "Wireless Mouse",
  "USB-C Cable",
  "Laptop Stand",
  "Bluetooth Headphones",
  "Phone Case",
  "Portable Charger",
  "HDMI Cable",
  "Webcam",
  "Keyboard",
  "Monitor",
  "Desk Lamp",
  "Notebook",
  "Pen Set",
  "Water Bottle",
  "Backpack",
]

export function generateOrderItems(count = 15847, maxOrderId = 5432): OrderItemRecord[] {
  const rng = new SeededRandom("dora-order-items-v1")
  const items: OrderItemRecord[] = []

  for (let i = 0; i < count; i++) {
    const orderId = rng.nextInt(1, maxOrderId)
    const productId = rng.nextInt(1, 500)
    const productName = rng.choice(PRODUCT_NAMES)
    const quantity = rng.nextInt(1, 10)
    const unitPrice = Math.round(rng.next() * 20000 + 500) / 100 // $5-$200
    const discount = rng.nextBoolean(0.3) ? Math.round(rng.next() * 20) : 0 // 30% chance of 0-20% discount
    const totalPrice = Math.round(unitPrice * quantity * (1 - discount / 100) * 100) / 100

    items.push({
      id: i + 1,
      orderId,
      productId,
      productName,
      quantity,
      unitPrice,
      discount,
      totalPrice,
      sku: rng.nextBoolean(0.8) ? `SKU-${String(productId).padStart(6, "0")}` : null,
    })
  }

  return items
}
