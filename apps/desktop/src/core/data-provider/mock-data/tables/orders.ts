import { CUSTOMERS } from "./customers";
import { PRODUCTS } from "./products";

const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];
const ADDRESSES = [
    "123 Main Street, Apt 4B",
    "456 Oak Avenue, Suite 100",
    "789 Pine Road",
    "321 Elm Boulevard",
    "654 Maple Lane",
    "987 Cedar Court",
    "147 Birch Way",
    "258 Willow Drive",
    "369 Spruce Circle",
    "741 Ash Street"
];

function randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number): string {
    const date = new Date(Date.now() - Math.random() * daysAgo * 86400000);
    return date.toISOString();
}

function generateOrders(count: number): Record<string, unknown>[] {
    const orders: Record<string, unknown>[] = [];

    for (let i = 1; i <= count; i++) {
        const customer = randomFrom(CUSTOMERS);
        const total = Math.round((50 + Math.random() * 500) * 100) / 100;

        orders.push({
            id: i,
            customer_id: customer.id,
            total,
            status: randomFrom(ORDER_STATUSES),
            shipping_address: randomFrom(ADDRESSES) + ", " + customer.city + ", " + customer.country,
            created_at: randomDate(90),
        });
    }

    return orders;
}

function generateOrderItems(orders: Record<string, unknown>[]): Record<string, unknown>[] {
    const items: Record<string, unknown>[] = [];
    let itemId = 1;

    orders.forEach(function (order) {
        const numItems = 1 + Math.floor(Math.random() * 4);
        const usedProducts = new Set<number>();

        for (let i = 0; i < numItems; i++) {
            let product;
            do {
                product = randomFrom(PRODUCTS);
            } while (usedProducts.has(product.id as number) && usedProducts.size < PRODUCTS.length);

            usedProducts.add(product.id as number);

            items.push({
                id: itemId++,
                order_id: order.id,
                product_id: product.id,
                quantity: 1 + Math.floor(Math.random() * 3),
                unit_price: product.price,
            });
        }
    });

    return items;
}

export const ORDERS = generateOrders(100);
export const ORDER_ITEMS = generateOrderItems(ORDERS);
