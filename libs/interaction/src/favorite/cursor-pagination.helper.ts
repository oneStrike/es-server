import { BadRequestException } from '@nestjs/common'

export interface CreatedAtIdCursor {
  createdAt: Date
  id: number
}

export interface CursorPageQuery {
  cursor?: string | null
  pageIndex?: number
  orderBy?: unknown
  startDate?: unknown
  endDate?: unknown
}

export interface CursorPageResult<T> {
  list: T[]
  pageSize: number
  hasMore: boolean
  nextCursor: string | null
}

export function assertCursorOnlyQuery(
  query: CursorPageQuery,
  resourceName: string,
) {
  const unsupportedFields: string[] = []
  if (query.pageIndex !== undefined && query.pageIndex !== null) {
    unsupportedFields.push('pageIndex')
  }
  if (query.orderBy !== undefined && query.orderBy !== null) {
    unsupportedFields.push('orderBy')
  }
  if (query.startDate !== undefined && query.startDate !== null) {
    unsupportedFields.push('startDate')
  }
  if (query.endDate !== undefined && query.endDate !== null) {
    unsupportedFields.push('endDate')
  }

  if (unsupportedFields.length > 0) {
    throw new BadRequestException(
      `${resourceName}仅支持 pageSize 和 cursor 查询，不支持 ${unsupportedFields.join(', ')}`,
    )
  }
}

export function encodeCreatedAtIdCursor(row: {
  createdAt: Date
  id: number
}) {
  return Buffer.from(
    JSON.stringify({
      createdAt: row.createdAt.toISOString(),
      id: row.id,
    }),
  ).toString('base64url')
}

export function parseCreatedAtIdCursor(
  cursor: string | null | undefined,
  resourceName: string,
): CreatedAtIdCursor | undefined {
  if (!cursor?.trim()) {
    return undefined
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor.trim(), 'base64url').toString('utf8'),
    ) as Record<string, unknown>
    const createdAt =
      typeof parsed.createdAt === 'string'
        ? new Date(parsed.createdAt)
        : undefined
    const id = parsed.id
    if (
      !createdAt ||
      Number.isNaN(createdAt.getTime()) ||
      typeof id !== 'number' ||
      !Number.isSafeInteger(id) ||
      id <= 0
    ) {
      throw new TypeError('invalid cursor payload')
    }

    return {
      createdAt,
      id,
    }
  } catch {
    throw new BadRequestException(`${resourceName} cursor 非法`)
  }
}

export function toCursorPageResult<T>(
  rows: T[],
  pageSize: number,
  encodeRow: (row: T) => string,
): CursorPageResult<T> {
  const hasMore = rows.length > pageSize
  const list = hasMore ? rows.slice(0, pageSize) : rows
  return {
    list,
    pageSize,
    hasMore,
    nextCursor: hasMore && list.length > 0 ? encodeRow(list[list.length - 1]) : null,
  }
}
