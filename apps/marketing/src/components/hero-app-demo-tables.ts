/**
 * Per-table schemas and rows for the hero demo. Each table carries its own
 * columns, tracks (grid widths) and records so switching tables in the demo
 * tells the same story the real /app does: a different shape, not the same
 * customers grid with the strings swapped out.
 */

export type TColumnKind = "pk" | "fk" | "text" | "number" | "date" | "money";

export type TDemoColumn = {
    name: string;
    type: string;
    kind: TColumnKind;
    track: string;
};

export type TDemoTable = {
    name: string;
    columns: TDemoColumn[];
    rows: string[][];
    indexes: number;
    /** Substring the "Filters" toggle matches against, per table. */
    filterToken: string;
};

const CUSTOMERS: TDemoTable = {
    name: "customers",
    indexes: 2,
    filterToken: "usa",
    columns: [
        { name: "id", type: "serial", kind: "pk", track: "52px" },
        { name: "name", type: "varchar(100)", kind: "text", track: "minmax(70px, 1.1fr)" },
        { name: "email", type: "varchar(255)", kind: "text", track: "minmax(70px, 1.4fr)" },
        { name: "phone", type: "varchar(20)", kind: "text", track: "minmax(70px, 0.9fr)" },
        { name: "city", type: "varchar(50)", kind: "text", track: "minmax(70px, 0.7fr)" },
        { name: "country", type: "varchar(50)", kind: "text", track: "minmax(70px, 0.8fr)" },
        { name: "created_at", type: "timestamp", kind: "date", track: "minmax(70px, 1fr)" },
    ],
    rows: [
        ["1", "Emma Johnson", "emma.johnson@example.com", "+1-415-552-8841", "San Diego", "USA", "2025-11-04 09:12:48"],
        ["2", "Liam Williams", "liam.williams@example.com", "+1-312-845-1190", "Chicago", "Canada", "2025-09-22 17:40:11"],
        ["3", "Olivia Garcia", "olivia.garcia@example.com", "+1-602-771-3360", "Phoenix", "United Arab Emirates", "2026-01-15 11:03:27"],
        ["4", "Noah Martinez", "noah.martinez@example.com", "", "Dallas", "Germany", "2025-12-30 08:55:02"],
        ["5", "Ava Davis", "ava.davis@example.com", "+1-718-334-2098", "New York", "France", "2025-10-18 22:14:39"],
        ["6", "Elijah Wilson", "elijah.wilson@example.com", "+1-512-667-4410", "Austin", "Australia", "2026-02-09 14:27:50"],
        ["7", "Sophia Brown", "sophia.brown@example.com", "+1-619-220-9913", "San Jose", "Netherlands", "2025-08-27 06:48:16"],
        ["8", "James Miller", "james.miller@example.com", "+1-704-558-1276", "Charlotte", "Sweden", "2026-03-01 19:31:44"],
        ["9", "Isabella Lopez", "isabella.lopez@example.com", "+1-215-870-6652", "Philadelphia", "USA", "2025-11-19 13:09:05"],
        ["10", "Oliver Anderson", "oliver.anderson@example.com", "+1-832-441-3389", "Houston", "Norway", "2025-12-12 10:52:33"],
        ["11", "Mia Thompson", "mia.thompson@example.com", "+1-206-334-7721", "Seattle", "United Kingdom", "2026-01-28 15:44:19"],
        ["12", "Lucas Rodriguez", "lucas.rodriguez@example.com", "+1-305-990-2287", "Miami", "Spain", "2025-09-05 08:20:56"],
    ],
};

const PRODUCTS: TDemoTable = {
    name: "products",
    indexes: 3,
    filterToken: "audio",
    columns: [
        { name: "id", type: "serial", kind: "pk", track: "52px" },
        { name: "sku", type: "varchar(32)", kind: "text", track: "minmax(70px, 0.9fr)" },
        { name: "name", type: "varchar(120)", kind: "text", track: "minmax(70px, 1.4fr)" },
        { name: "category", type: "varchar(40)", kind: "text", track: "minmax(70px, 0.8fr)" },
        { name: "price", type: "numeric(10,2)", kind: "money", track: "minmax(70px, 0.7fr)" },
        { name: "stock", type: "integer", kind: "number", track: "minmax(70px, 0.6fr)" },
        { name: "updated_at", type: "timestamp", kind: "date", track: "minmax(70px, 1fr)" },
    ],
    rows: [
        ["1", "AUD-KH40-BLK", "Studio Headphones KH40", "audio", "189.00", "412", "2026-02-18 11:24:03"],
        ["2", "AUD-SPK12-GRY", "Bookshelf Speaker Pair", "audio", "349.50", "88", "2026-01-30 16:02:41"],
        ["3", "KBD-MX87-WHT", "Mechanical Keyboard 87", "peripherals", "129.99", "1204", "2026-03-02 08:47:19"],
        ["4", "MON-U27-4K", "27\" 4K IPS Monitor", "displays", "529.00", "63", "2025-12-21 13:55:27"],
        ["5", "CAM-W4K-PRO", "Webcam 4K Pro", "video", "159.00", "", "2026-02-04 09:31:50"],
        ["6", "AUD-MIC7-BLK", "Condenser Mic M7", "audio", "99.00", "530", "2026-01-11 18:20:12"],
        ["7", "HUB-TC9-SLV", "USB-C Dock 9-in-1", "peripherals", "89.95", "776", "2025-11-27 07:14:38"],
        ["8", "MON-U32-5K", "32\" 5K Reference Display", "displays", "1299.00", "17", "2026-03-08 20:09:44"],
        ["9", "KBD-MX61-BLK", "Mechanical Keyboard 61", "peripherals", "109.99", "944", "2025-10-30 12:41:05"],
        ["10", "CBL-TB4-2M", "Thunderbolt 4 Cable 2m", "cables", "39.00", "3180", "2026-02-25 15:33:29"],
        ["11", "AUD-DAC2-BLK", "Desktop DAC / Amp", "audio", "279.00", "121", "2026-01-19 10:52:16"],
        ["12", "CHR-GAN65-WHT", "GaN Charger 65W", "power", "49.00", "2044", "2025-12-06 17:26:51"],
    ],
};

const ORDERS: TDemoTable = {
    name: "orders",
    indexes: 4,
    filterToken: "shipped",
    columns: [
        { name: "id", type: "serial", kind: "pk", track: "52px" },
        { name: "customer_id", type: "integer", kind: "fk", track: "minmax(70px, 0.8fr)" },
        { name: "status", type: "varchar(20)", kind: "text", track: "minmax(70px, 0.8fr)" },
        { name: "total", type: "numeric(10,2)", kind: "money", track: "minmax(70px, 0.7fr)" },
        { name: "currency", type: "char(3)", kind: "text", track: "minmax(70px, 0.5fr)" },
        { name: "channel", type: "varchar(20)", kind: "text", track: "minmax(70px, 0.7fr)" },
        { name: "placed_at", type: "timestamp", kind: "date", track: "minmax(70px, 1fr)" },
    ],
    rows: [
        ["1", "7", "shipped", "538.99", "USD", "web", "2026-03-01 09:14:22"],
        ["2", "3", "pending", "129.99", "USD", "web", "2026-03-02 11:48:07"],
        ["3", "11", "shipped", "1299.00", "EUR", "partner", "2026-02-27 16:31:55"],
        ["4", "1", "refunded", "89.95", "USD", "mobile", "2026-02-19 08:03:41"],
        ["5", "9", "delivered", "268.00", "USD", "web", "2026-02-14 19:22:36"],
        ["6", "5", "shipped", "749.50", "GBP", "web", "2026-03-04 07:56:18"],
        ["7", "2", "cancelled", "", "USD", "mobile", "2026-01-28 14:40:09"],
        ["8", "12", "delivered", "39.00", "EUR", "web", "2026-02-08 21:17:44"],
        ["9", "6", "pending", "1478.00", "USD", "partner", "2026-03-06 10:29:51"],
        ["10", "4", "delivered", "218.94", "SEK", "web", "2026-01-16 13:05:27"],
        ["11", "10", "shipped", "529.00", "USD", "mobile", "2026-02-22 18:44:13"],
        ["12", "8", "delivered", "99.00", "NOK", "web", "2026-01-09 06:38:02"],
    ],
};

const ORDER_ITEMS: TDemoTable = {
    name: "order_items",
    indexes: 3,
    filterToken: "3",
    columns: [
        { name: "id", type: "serial", kind: "pk", track: "52px" },
        { name: "order_id", type: "integer", kind: "fk", track: "minmax(70px, 0.8fr)" },
        { name: "product_id", type: "integer", kind: "fk", track: "minmax(70px, 0.8fr)" },
        { name: "quantity", type: "integer", kind: "number", track: "minmax(70px, 0.7fr)" },
        { name: "unit_price", type: "numeric(10,2)", kind: "money", track: "minmax(70px, 0.8fr)" },
        { name: "discount", type: "numeric(5,2)", kind: "money", track: "minmax(70px, 0.7fr)" },
        { name: "fulfilled_at", type: "timestamp", kind: "date", track: "minmax(70px, 1fr)" },
    ],
    rows: [
        ["1", "1", "4", "1", "529.00", "0.00", "2026-03-02 12:04:18"],
        ["2", "1", "10", "1", "39.00", "5.00", "2026-03-02 12:04:18"],
        ["3", "2", "3", "1", "129.99", "0.00", ""],
        ["4", "3", "8", "1", "1299.00", "0.00", "2026-02-28 09:47:31"],
        ["5", "4", "7", "1", "89.95", "0.00", "2026-02-20 15:12:56"],
        ["6", "5", "6", "2", "99.00", "10.00", "2026-02-15 08:36:24"],
        ["7", "5", "12", "1", "49.00", "0.00", "2026-02-15 08:36:24"],
        ["8", "6", "2", "2", "349.50", "15.00", "2026-03-05 17:29:40"],
        ["9", "8", "10", "1", "39.00", "0.00", "2026-02-09 10:53:07"],
        ["10", "9", "8", "1", "1299.00", "0.00", ""],
        ["11", "9", "11", "1", "279.00", "20.00", ""],
        ["12", "11", "4", "1", "529.00", "0.00", "2026-02-23 07:41:15"],
    ],
};

const INVENTORY: TDemoTable = {
    name: "inventory",
    indexes: 2,
    filterToken: "berlin",
    columns: [
        { name: "id", type: "serial", kind: "pk", track: "52px" },
        { name: "product_id", type: "integer", kind: "fk", track: "minmax(70px, 0.8fr)" },
        { name: "warehouse", type: "varchar(40)", kind: "text", track: "minmax(70px, 1fr)" },
        { name: "on_hand", type: "integer", kind: "number", track: "minmax(70px, 0.7fr)" },
        { name: "reserved", type: "integer", kind: "number", track: "minmax(70px, 0.7fr)" },
        { name: "reorder_at", type: "integer", kind: "number", track: "minmax(70px, 0.7fr)" },
        { name: "counted_at", type: "timestamp", kind: "date", track: "minmax(70px, 1fr)" },
    ],
    rows: [
        ["1", "1", "berlin-dc1", "412", "38", "100", "2026-03-01 04:00:00"],
        ["2", "2", "berlin-dc1", "88", "12", "40", "2026-03-01 04:00:00"],
        ["3", "3", "reno-dc2", "1204", "216", "300", "2026-03-01 04:00:00"],
        ["4", "4", "reno-dc2", "63", "9", "25", "2026-03-01 04:00:00"],
        ["5", "5", "berlin-dc1", "0", "0", "50", "2026-02-28 04:00:00"],
        ["6", "6", "singapore-dc1", "530", "74", "150", "2026-03-01 04:00:00"],
        ["7", "7", "reno-dc2", "776", "103", "200", "2026-03-01 04:00:00"],
        ["8", "8", "berlin-dc1", "17", "6", "10", "2026-03-01 04:00:00"],
        ["9", "9", "singapore-dc1", "944", "158", "250", "2026-02-27 04:00:00"],
        ["10", "10", "reno-dc2", "3180", "402", "800", "2026-03-01 04:00:00"],
        ["11", "11", "berlin-dc1", "121", "17", "60", "2026-03-01 04:00:00"],
        ["12", "12", "singapore-dc1", "2044", "311", "500", "2026-03-01 04:00:00"],
    ],
};

const TRANSACTIONS: TDemoTable = {
    name: "transactions",
    indexes: 4,
    filterToken: "succeeded",
    columns: [
        { name: "id", type: "serial", kind: "pk", track: "52px" },
        { name: "order_id", type: "integer", kind: "fk", track: "minmax(70px, 0.7fr)" },
        { name: "provider", type: "varchar(20)", kind: "text", track: "minmax(70px, 0.8fr)" },
        { name: "reference", type: "varchar(32)", kind: "text", track: "minmax(70px, 1.3fr)" },
        { name: "amount", type: "numeric(10,2)", kind: "money", track: "minmax(70px, 0.7fr)" },
        { name: "status", type: "varchar(20)", kind: "text", track: "minmax(70px, 0.8fr)" },
        { name: "processed_at", type: "timestamp", kind: "date", track: "minmax(70px, 1fr)" },
    ],
    rows: [
        ["1", "1", "stripe", "pi_3Qk1mBAx7Lz9wQ2r", "538.99", "succeeded", "2026-03-01 09:14:31"],
        ["2", "2", "stripe", "pi_3Qk4vDAx7Lz9wR8t", "129.99", "requires_action", "2026-03-02 11:48:16"],
        ["3", "3", "adyen", "8836271940552117", "1299.00", "succeeded", "2026-02-27 16:32:04"],
        ["4", "4", "stripe", "pi_3Qj8nCAx7Lz9wM4k", "89.95", "refunded", "2026-02-19 08:04:02"],
        ["5", "5", "paypal", "6XK92183VN4471028", "268.00", "succeeded", "2026-02-14 19:22:49"],
        ["6", "6", "adyen", "8836274118903342", "749.50", "succeeded", "2026-03-04 07:56:27"],
        ["7", "7", "stripe", "pi_3Qh2kAAx7Lz9wB1c", "", "canceled", "2026-01-28 14:40:22"],
        ["8", "8", "stripe", "pi_3Qj1pFAx7Lz9wT6v", "39.00", "succeeded", "2026-02-08 21:17:53"],
        ["9", "9", "paypal", "3RD70926KW8813455", "1478.00", "pending", "2026-03-06 10:30:04"],
        ["10", "10", "adyen", "8836269073221806", "218.94", "succeeded", "2026-01-16 13:05:38"],
        ["11", "11", "stripe", "pi_3Qk0sEAx7Lz9wY3n", "529.00", "succeeded", "2026-02-22 18:44:26"],
        ["12", "12", "stripe", "pi_3Qh9tGAx7Lz9wD7p", "99.00", "succeeded", "2026-01-09 06:38:14"],
    ],
};

const SUBSCRIPTIONS: TDemoTable = {
    name: "subscriptions",
    indexes: 3,
    filterToken: "active",
    columns: [
        { name: "id", type: "serial", kind: "pk", track: "52px" },
        { name: "customer_id", type: "integer", kind: "fk", track: "minmax(70px, 0.8fr)" },
        { name: "plan", type: "varchar(30)", kind: "text", track: "minmax(70px, 0.9fr)" },
        { name: "status", type: "varchar(20)", kind: "text", track: "minmax(70px, 0.8fr)" },
        { name: "seats", type: "integer", kind: "number", track: "minmax(70px, 0.6fr)" },
        { name: "mrr", type: "numeric(8,2)", kind: "money", track: "minmax(70px, 0.7fr)" },
        { name: "renews_at", type: "date", kind: "date", track: "minmax(70px, 1fr)" },
    ],
    rows: [
        ["1", "1", "team", "active", "12", "228.00", "2026-04-01"],
        ["2", "3", "pro", "active", "1", "19.00", "2026-03-18"],
        ["3", "5", "enterprise", "active", "140", "4200.00", "2026-07-01"],
        ["4", "2", "pro", "past_due", "1", "19.00", "2026-03-11"],
        ["5", "9", "team", "active", "8", "152.00", "2026-03-25"],
        ["6", "4", "free", "active", "1", "0.00", ""],
        ["7", "11", "enterprise", "active", "310", "9300.00", "2026-09-01"],
        ["8", "7", "team", "canceled", "5", "0.00", "2026-02-14"],
        ["9", "6", "pro", "active", "1", "19.00", "2026-03-29"],
        ["10", "12", "team", "trialing", "3", "0.00", "2026-03-15"],
        ["11", "8", "pro", "active", "1", "19.00", "2026-04-06"],
        ["12", "10", "enterprise", "active", "85", "2550.00", "2026-06-01"],
    ],
};

export const demoTables: TDemoTable[] = [
    CUSTOMERS,
    PRODUCTS,
    ORDERS,
    ORDER_ITEMS,
    INVENTORY,
    TRANSACTIONS,
    SUBSCRIPTIONS,
];

export function findTable(name: string): TDemoTable {
    return demoTables.find((table) => table.name === name) ?? CUSTOMERS;
}

/** `grid-template-columns` for a table: leading checkbox gutter + one track per column. */
export function gridTemplate(table: TDemoTable): string {
    return "30px " + table.columns.map((column) => column.track).join(" ");
}
