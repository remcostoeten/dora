import type { ProductRecord } from "../types"
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
    "Mechanical Keyboard",
    "Monitor Stand",
    "Desk Lamp",
    "Notebook",
    "Pen Set",
    "Water Bottle",
    "Backpack",
    "USB Hub",
    "Desk Mat",
    "Cable Organizer",
    "Screen Protector",
    "Mouse Pad",
]

const CATEGORIES = ["Electronics", "Office", "Accessories", "Storage", "Audio"]

export function generateProducts(count = 156): ProductRecord[] {
    const rng = new SeededRandom("dora-products-v1")
    const products: ProductRecord[] = []

    for (let i = 0; i < count; i++) {
        const name = rng.choice(PRODUCT_NAMES)
        const category = rng.choice(CATEGORIES)
        const basePrice = Math.round(rng.next() * 20000 + 500) / 100 // $5-$200

        products.push({
            id: i + 1,
            name: `${name} ${i + 1}`,
            description: rng.nextBoolean(0.7) ? `High quality ${name.toLowerCase()} for everyday use.` : null,
            price: basePrice,
            category,
            inStock: rng.nextBoolean(0.85),
        })
    }

    return products
}
