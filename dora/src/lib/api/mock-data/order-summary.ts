import type { OrderSummaryRecord } from "../types"

export function generateOrderSummary(): OrderSummaryRecord[] {
  return [
    {
      status: "delivered",
      orderCount: 3245,
      totalRevenue: 1284392.45,
    },
    {
      status: "shipped",
      orderCount: 892,
      totalRevenue: 342891.23,
    },
    {
      status: "processing",
      orderCount: 654,
      totalRevenue: 245673.12,
    },
  ]
}
