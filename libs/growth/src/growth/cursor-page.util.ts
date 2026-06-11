import { BadRequestException } from '@nestjs/common'

export interface CursorPageResult<T> {
  list: T[]
  pageSize: number
  hasMore: boolean
  nextCursor: string | null
}

export function encodeGrowthCursor(payload: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function parseGrowthCursor<T extends Record<string, unknown>>(
  cursor: string | null | undefined,
  message: string,
  validate: (payload: Record<string, unknown>) => T | undefined,
) {
  if (!cursor?.trim()) {
    return undefined
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor.trim(), 'base64url').toString('utf8'),
    )
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new TypeError('invalid cursor payload')
    }
    const result = validate(parsed as Record<string, unknown>)
    if (!result) {
      throw new TypeError('invalid cursor payload')
    }
    return result
  } catch {
    throw new BadRequestException(message)
  }
}

export function toCursorPage<T>(
  rows: T[],
  pageSize: number,
  encode: (item: T) => string,
): CursorPageResult<T> {
  const list = rows.slice(0, pageSize)
  const hasMore = rows.length > pageSize

  return {
    list,
    pageSize,
    hasMore,
    nextCursor:
      hasMore && list.length > 0 ? encode(list[list.length - 1]) : null,
  }
}

export function rejectOffsetPaginationFields(
  query: object,
  messagePrefix: string,
) {
  const record = query as Record<string, unknown>
  const unsupportedFields = ['pageIndex', 'orderBy', 'startDate', 'endDate'].filter(
    (field) => record[field] !== undefined && record[field] !== null,
  )

  if (unsupportedFields.length > 0) {
    throw new BadRequestException(
      `${messagePrefix}仅支持 pageSize 和 cursor 查询，不支持 ${unsupportedFields.join(', ')}`,
    )
  }
}
