import type { ApiErrorResponse, ErrorCode } from "./types"
import { v4 as uuidv4 } from "uuid"

export function createErrorResponse(code: ErrorCode, message: string, details?: Record<string, unknown>): Response {
  const errorResponse: ApiErrorResponse = {
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    },
  }

  const statusCode = getStatusCode(code)

  return Response.json(errorResponse, { status: statusCode })
}

function getStatusCode(code: ErrorCode): number {
  switch (code) {
    case "TABLE_NOT_FOUND":
    case "QUERY_ID_NOT_FOUND":
      return 404
    case "PAGE_OUT_OF_RANGE":
    case "INVALID_SORT_COLUMN":
    case "FILTER_SYNTAX_ERROR":
      return 400
    case "PAGE_SIZE_TOO_LARGE":
      return 400
    default:
      return 500
  }
}
