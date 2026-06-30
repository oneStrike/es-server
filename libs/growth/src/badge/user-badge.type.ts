import type { userBadge } from '@db/schema'

/** 用户徽章定义表读取行，直接从 user_badge schema 推导。 */
export type UserBadgeSelect = typeof userBadge.$inferSelect
