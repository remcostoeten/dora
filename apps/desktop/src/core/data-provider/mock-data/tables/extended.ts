import { randomFrom, randomDate, randomInt, randomFloat } from "./utils";

const EMPLOYEE_NAMES = [
    "Alice Johnson", "Bob Smith", "Carol Williams", "David Brown", "Eva Martinez",
    "Frank Garcia", "Grace Lee", "Henry Wilson", "Ivy Chen", "Jack Thompson",
    "Karen Davis", "Liam Anderson", "Maria Rodriguez", "Nathan Taylor", "Olivia Moore",
    "Peter Jackson", "Quinn White", "Rachel Harris", "Samuel Clark", "Tiffany Lewis",
    "Uma Patel", "Victor Kim", "Wendy Scott", "Xavier Young", "Yuki Tanaka",
    "Zack Miller", "Amy Baker", "Brian Adams", "Chloe Wright", "Derek Turner"
];

const DEPARTMENTS = ["Engineering", "Product", "Design", "Marketing", "Sales", "HR", "Finance", "Operations", "Legal", "Support"];
const POSITIONS = ["Junior", "Mid-level", "Senior", "Lead", "Principal", "Manager", "Director", "VP"];
const STATUSES = ["active", "on_leave", "terminated", "probation"];

function generateEmployees(): Record<string, unknown>[] {
    return EMPLOYEE_NAMES.map(function(name, i) {
        const hireDate = randomDate(1500);
        return {
            id: i + 1,
            employee_id: `EMP-${String(10000 + i).padStart(5, "0")}`,
            full_name: name,
            email: name.toLowerCase().replace(" ", ".") + "@company.com",
            department: randomFrom(DEPARTMENTS),
            position: `${randomFrom(POSITIONS)} ${randomFrom(["Engineer", "Designer", "Analyst", "Specialist", "Coordinator"])}`,
            salary: randomInt(50000, 200000),
            hire_date: hireDate,
            manager_id: i > 5 ? randomInt(1, 5) : null,
            status: i < 25 ? "active" : randomFrom(STATUSES),
            phone: `+1-${randomInt(200, 999)}-${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
            office_location: randomFrom(["NYC", "SF", "Austin", "Seattle", "Boston", "Remote"]),
            created_at: hireDate,
            updated_at: randomDate(30)
        };
    });
}

const TRANSACTIONS_COUNT = 1200;
const TRANSACTION_TYPES = ["payment", "refund", "transfer", "deposit", "withdrawal", "fee"];
const PAYMENT_METHODS = ["credit_card", "debit_card", "bank_transfer", "paypal", "crypto", "wire"];
const TRANSACTION_STATUSES = ["completed", "pending", "failed", "processing", "cancelled"];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];

function generateTransactions(): Record<string, unknown>[] {
    const transactions: Record<string, unknown>[] = [];
    for (let i = 0; i < TRANSACTIONS_COUNT; i++) {
        transactions.push({
            id: i + 1,
            transaction_id: `TXN-${generateId()}`.toUpperCase(),
            type: randomFrom(TRANSACTION_TYPES),
            amount: randomFloat(10, 5000),
            currency: randomFrom(CURRENCIES),
            status: randomFrom(TRANSACTION_STATUSES),
            payment_method: randomFrom(PAYMENT_METHODS),
            customer_id: randomInt(1, 50),
            merchant_id: randomInt(1, 20),
            description: randomFrom([
                "Product purchase", "Subscription renewal", "Service fee",
                "Account credit", "Withdrawal to bank", "Transfer between accounts"
            ]),
            fee_amount: randomFloat(0, 50),
            net_amount: randomFloat(10, 4950),
            ip_address: `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`,
            created_at: randomDate(365),
            processed_at: randomDate(365)
        });
    }
    return transactions;
}

function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}

const ANALYTICS_COUNT = 5000;
const PAGES = ["/", "/products", "/cart", "/checkout", "/account", "/blog", "/about", "/contact", "/pricing", "/features"];
const BROWSERS = ["Chrome", "Firefox", "Safari", "Edge", "Opera"];
const DEVICES = ["desktop", "mobile", "tablet"];
const COUNTRIES = ["US", "UK", "DE", "FR", "CA", "AU", "JP", "BR", "IN", "MX"];
const REFERRERS = ["google", "facebook", "twitter", "direct", "email", "linkedin", "tiktok", "bing"];

function generatePageViews(): Record<string, unknown>[] {
    const views: Record<string, unknown>[] = [];
    for (let i = 0; i < ANALYTICS_COUNT; i++) {
        views.push({
            id: i + 1,
            session_id: `sess_${generateId()}`,
            user_id: Math.random() > 0.3 ? randomInt(1, 100) : null,
            page_path: randomFrom(PAGES),
            referrer: randomFrom(REFERRERS),
            browser: randomFrom(BROWSERS),
            device_type: randomFrom(DEVICES),
            country: randomFrom(COUNTRIES),
            duration_seconds: randomInt(5, 600),
            scroll_depth: randomInt(0, 100),
            is_bounce: Math.random() > 0.7,
            timestamp: randomDate(90)
        });
    }
    return views;
}

const INVENTORY_ITEMS = 120;
const WAREHOUSES = ["WH-NYC-01", "WH-LA-01", "WH-CHI-01", "WH-ATL-01", "WH-SEA-01"];
const SKU_PREFIXES = ["SKU", "PROD", "ITM", "INV"];

function generateInventory(): Record<string, unknown>[] {
    const items: Record<string, unknown>[] = [];
    for (let i = 0; i < INVENTORY_ITEMS; i++) {
        items.push({
            id: i + 1,
            sku: `${randomFrom(SKU_PREFIXES)}-${String(100000 + i).padStart(6, "0")}`,
            product_name: randomFrom([
                "Wireless Mouse", "USB Cable", "Laptop Stand", "Monitor Arm",
                "Keyboard", "Headphones", "Webcam", "Desk Lamp", "Chair Mat",
                "Power Strip", "HDMI Adapter", "Phone Holder", "Stylus Pen"
            ]) + ` ${randomFrom(["Pro", "Plus", "Max", "Lite", ""])}`.trim(),
            warehouse_id: randomFrom(WAREHOUSES),
            quantity: randomInt(0, 1000),
            reserved_quantity: randomInt(0, 50),
            reorder_point: randomInt(10, 100),
            unit_cost: randomFloat(5, 500),
            last_restocked: randomDate(180),
            last_counted: randomDate(30),
            location_aisle: randomFrom(["A", "B", "C", "D", "E"]),
            location_shelf: randomInt(1, 10),
            location_bin: randomInt(1, 50),
            updated_at: randomDate(7)
        });
    }
    return items;
}

const AUDIT_LOG_COUNT = 1500;
const ACTIONS = ["create", "update", "delete", "login", "logout", "export", "import", "approve", "reject", "view"];
const RESOURCES = ["user", "order", "product", "customer", "payment", "setting", "report", "inventory"];

function generateAuditLogs(): Record<string, unknown>[] {
    const logs: Record<string, unknown>[] = [];
    for (let i = 0; i < AUDIT_LOG_COUNT; i++) {
        logs.push({
            id: i + 1,
            action: randomFrom(ACTIONS),
            resource_type: randomFrom(RESOURCES),
            resource_id: randomInt(1, 500),
            user_id: randomInt(1, 30),
            user_email: `user${randomInt(1, 30)}@company.com`,
            ip_address: `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`,
            user_agent: randomFrom([
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 14) Safari/17.0",
                "Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0"
            ]),
            changes: JSON.stringify({ field: randomFrom(["name", "status", "price", "quantity"]), old: "value1", new: "value2" }),
            created_at: randomDate(90)
        });
    }
    return logs;
}

const SUPPORT_TICKETS_COUNT = 80;
const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"];
const TICKET_STATUSES = ["open", "in_progress", "waiting_customer", "resolved", "closed"];
const TICKET_CATEGORIES = ["billing", "technical", "account", "feature_request", "bug_report", "general"];

function generateSupportTickets(): Record<string, unknown>[] {
    const tickets: Record<string, unknown>[] = [];
    for (let i = 0; i < SUPPORT_TICKETS_COUNT; i++) {
        const createdAt = randomDate(180);
        tickets.push({
            id: i + 1,
            ticket_number: `TICK-${String(2024000 + i)}`,
            subject: randomFrom([
                "Cannot login to my account",
                "Payment not processed",
                "Feature request: dark mode",
                "App crashes on startup",
                "Need invoice for recent purchase",
                "How to export my data?",
                "Billing discrepancy",
                "Account verification issue"
            ]),
            description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            customer_id: randomInt(1, 50),
            customer_email: `customer${randomInt(1, 50)}@example.com`,
            priority: randomFrom(TICKET_PRIORITIES),
            status: randomFrom(TICKET_STATUSES),
            category: randomFrom(TICKET_CATEGORIES),
            assigned_to: Math.random() > 0.2 ? randomInt(1, 10) : null,
            first_response_at: Math.random() > 0.3 ? randomDate(170) : null,
            resolved_at: Math.random() > 0.5 ? randomDate(160) : null,
            satisfaction_rating: Math.random() > 0.6 ? randomInt(1, 5) : null,
            created_at: createdAt,
            updated_at: randomDate(30)
        });
    }
    return tickets;
}

const EMAIL_CAMPAIGNS_COUNT = 25;
const CAMPAIGN_TYPES = ["promotional", "newsletter", "transactional", "welcome", "re-engagement", "announcement"];
const CAMPAIGN_STATUSES = ["draft", "scheduled", "sending", "sent", "paused", "cancelled"];

function generateEmailCampaigns(): Record<string, unknown>[] {
    const campaigns: Record<string, unknown>[] = [];
    for (let i = 0; i < EMAIL_CAMPAIGNS_COUNT; i++) {
        const sent = randomInt(1000, 50000);
        const delivered = Math.floor(sent * randomFloat(0.92, 0.99));
        const opened = Math.floor(delivered * randomFloat(0.15, 0.45));
        const clicked = Math.floor(opened * randomFloat(0.1, 0.4));
        campaigns.push({
            id: i + 1,
            campaign_name: randomFrom([
                "Summer Sale 2024", "New Product Launch", "Weekly Newsletter",
                "Welcome Series", "Cart Abandonment", "Black Friday Deals",
                "Customer Survey", "Feature Announcement", "Holiday Special"
            ]) + ` #${i + 1}`,
            type: randomFrom(CAMPAIGN_TYPES),
            status: randomFrom(CAMPAIGN_STATUSES),
            subject_line: randomFrom([
                "Don't miss out!", "Your exclusive offer inside",
                "This week's top picks", "Welcome to our community",
                "Complete your purchase", "Big savings await!"
            ]),
            from_email: "noreply@company.com",
            sent_count: sent,
            delivered_count: delivered,
            open_count: opened,
            click_count: clicked,
            unsubscribe_count: randomInt(10, 200),
            bounce_count: sent - delivered,
            scheduled_at: randomDate(90),
            sent_at: Math.random() > 0.3 ? randomDate(80) : null,
            created_at: randomDate(120),
            updated_at: randomDate(10)
        });
    }
    return campaigns;
}

const API_LOGS_COUNT = 2500;
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const API_ENDPOINTS = [
    "/api/v1/users", "/api/v1/orders", "/api/v1/products",
    "/api/v1/auth/login", "/api/v1/auth/logout", "/api/v1/payments",
    "/api/v1/search", "/api/v1/reports", "/api/v1/webhooks"
];
const STATUS_CODES = [200, 201, 204, 400, 401, 403, 404, 500, 502, 503];

function generateApiLogs(): Record<string, unknown>[] {
    const logs: Record<string, unknown>[] = [];
    for (let i = 0; i < API_LOGS_COUNT; i++) {
        const statusCode = Math.random() > 0.1 ? randomFrom([200, 201, 204]) : randomFrom([400, 401, 403, 404, 500]);
        logs.push({
            id: i + 1,
            request_id: `req_${generateId()}`,
            method: randomFrom(HTTP_METHODS),
            endpoint: randomFrom(API_ENDPOINTS),
            status_code: statusCode,
            response_time_ms: randomInt(10, 2000),
            request_body_size: randomInt(0, 10000),
            response_body_size: randomInt(100, 50000),
            user_id: Math.random() > 0.2 ? randomInt(1, 100) : null,
            api_key_id: Math.random() > 0.5 ? randomInt(1, 20) : null,
            ip_address: `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`,
            user_agent: randomFrom(["axios/1.6.0", "python-requests/2.31", "curl/8.4.0", "PostmanRuntime/7.35"]),
            error_message: statusCode >= 400 ? randomFrom(["Invalid request", "Unauthorized", "Not found", "Internal error"]) : null,
            timestamp: randomDate(30)
        });
    }
    return logs;
}

const SUBSCRIPTIONS_COUNT = 60;
const PLAN_NAMES = ["Free", "Starter", "Pro", "Business", "Enterprise"];
const BILLING_CYCLES = ["monthly", "yearly"];
const SUBSCRIPTION_STATUSES = ["active", "cancelled", "past_due", "trialing", "paused"];

function generateSubscriptions(): Record<string, unknown>[] {
    const subscriptions: Record<string, unknown>[] = [];
    for (let i = 0; i < SUBSCRIPTIONS_COUNT; i++) {
        const plan = randomFrom(PLAN_NAMES);
        const prices: Record<string, number> = { Free: 0, Starter: 9, Pro: 29, Business: 99, Enterprise: 299 };
        const createdAt = randomDate(730);
        subscriptions.push({
            id: i + 1,
            subscription_id: `sub_${generateId()}`,
            customer_id: randomInt(1, 50),
            plan_name: plan,
            price: prices[plan],
            billing_cycle: plan === "Free" ? null : randomFrom(BILLING_CYCLES),
            status: plan === "Free" ? "active" : randomFrom(SUBSCRIPTION_STATUSES),
            current_period_start: randomDate(30),
            current_period_end: randomDate(-30),
            trial_end: Math.random() > 0.7 ? randomDate(-14) : null,
            cancelled_at: Math.random() > 0.8 ? randomDate(60) : null,
            stripe_subscription_id: plan !== "Free" ? `sub_stripe_${generateId()}` : null,
            created_at: createdAt,
            updated_at: randomDate(7)
        });
    }
    return subscriptions;
}

export const EMPLOYEES = generateEmployees();
export const TRANSACTIONS = generateTransactions();
export const PAGE_VIEWS = generatePageViews();
export const INVENTORY = generateInventory();
export const AUDIT_LOGS = generateAuditLogs();
export const SUPPORT_TICKETS = generateSupportTickets();
export const EMAIL_CAMPAIGNS = generateEmailCampaigns();
export const API_LOGS = generateApiLogs();
export const SUBSCRIPTIONS = generateSubscriptions();
