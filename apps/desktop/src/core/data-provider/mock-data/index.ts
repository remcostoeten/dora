export { MOCK_CONNECTIONS } from "./connections";
export { MOCK_SCHEMAS } from "./schemas";
export { MOCK_SCRIPTS } from "./scripts";

import { CUSTOMERS } from "./tables/customers";
import { PRODUCTS } from "./tables/products";
import { ORDERS, ORDER_ITEMS } from "./tables/orders";
import { USERS } from "./tables/users";
import { POSTS } from "./tables/posts";
import { COMMENTS } from "./tables/comments";
import {
    EMPLOYEES,
    TRANSACTIONS,
    PAGE_VIEWS,
    INVENTORY,
    AUDIT_LOGS,
    SUPPORT_TICKETS,
    EMAIL_CAMPAIGNS,
    API_LOGS,
    SUBSCRIPTIONS
} from "./tables/extended";

const TAGS: Record<string, unknown>[] = [
    { id: 1, name: "JavaScript", slug: "javascript" },
    { id: 2, name: "TypeScript", slug: "typescript" },
    { id: 3, name: "React", slug: "react" },
    { id: 4, name: "Node.js", slug: "nodejs" },
    { id: 5, name: "CSS", slug: "css" },
    { id: 6, name: "DevOps", slug: "devops" },
    { id: 7, name: "Testing", slug: "testing" },
    { id: 8, name: "Database", slug: "database" },
    { id: 9, name: "Security", slug: "security" },
    { id: 10, name: "Performance", slug: "performance" },
    { id: 11, name: "Architecture", slug: "architecture" },
    { id: 12, name: "Best Practices", slug: "best-practices" },
    { id: 13, name: "Tutorial", slug: "tutorial" },
    { id: 14, name: "Git", slug: "git" },
    { id: 15, name: "API", slug: "api" },
];

export const MOCK_TABLE_DATA: Record<string, Record<string, unknown>[]> = {
    "demo-ecommerce-001:customers": CUSTOMERS,
    "demo-ecommerce-001:products": PRODUCTS,
    "demo-ecommerce-001:orders": ORDERS,
    "demo-ecommerce-001:order_items": ORDER_ITEMS,
    "demo-ecommerce-001:inventory": INVENTORY,
    "demo-ecommerce-001:transactions": TRANSACTIONS,
    "demo-ecommerce-001:subscriptions": SUBSCRIPTIONS,
    "demo-blog-002:users": USERS,
    "demo-blog-002:posts": POSTS,
    "demo-blog-002:comments": COMMENTS,
    "demo-blog-002:tags": TAGS,
    "demo-blog-002:page_views": PAGE_VIEWS,
    "demo-analytics-003:page_views": PAGE_VIEWS,
    "demo-analytics-003:api_logs": API_LOGS,
    "demo-analytics-003:email_campaigns": EMAIL_CAMPAIGNS,
    "demo-hr-004:employees": EMPLOYEES,
    "demo-hr-004:audit_logs": AUDIT_LOGS,
    "demo-hr-004:support_tickets": SUPPORT_TICKETS,
};

