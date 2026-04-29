import type { SQL } from 'drizzle-orm'

export type ForumSearchCondition = SQL | undefined

export type ForumSearchConditionTuple = [SQL, ...SQL[]]
