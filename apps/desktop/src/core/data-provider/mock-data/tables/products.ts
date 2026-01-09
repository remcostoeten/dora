const PRODUCT_NAMES = [
    "Wireless Bluetooth Headphones", "USB-C Hub Adapter", "Mechanical Keyboard", "Gaming Mouse",
    "4K Webcam", "Portable SSD 1TB", "Laptop Stand", "LED Desk Lamp", "Ergonomic Mouse Pad",
    "Monitor Light Bar", "Wireless Charger", "Smart Power Strip", "Noise Canceling Earbuds",
    "Tablet Stylus Pen", "Cable Management Kit", "Webcam Cover Slider", "USB Microphone",
    "Laptop Cooling Pad", "HDMI Cable 6ft", "Screen Cleaner Kit", "Desk Organizer",
    "Phone Stand", "Blue Light Glasses", "Wrist Rest Pad", "External Battery Pack"
];

const CATEGORIES = ["Electronics", "Accessories", "Audio", "Computer Parts", "Home Office"];

function randomPrice(min: number, max: number): number {
    return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function randomStock(): number {
    return Math.floor(Math.random() * 500);
}

function randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number): string {
    const date = new Date(Date.now() - Math.random() * daysAgo * 86400000);
    return date.toISOString();
}

function generateProducts(): Record<string, unknown>[] {
    return PRODUCT_NAMES.map(function (name, i) {
        return {
            id: i + 1,
            name,
            description: "High-quality " + name.toLowerCase() + " for professional and personal use.",
            price: randomPrice(19.99, 299.99),
            stock: randomStock(),
            category: randomFrom(CATEGORIES),
            created_at: randomDate(180),
        };
    });
}

export const PRODUCTS = generateProducts();
