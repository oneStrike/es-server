import type { adminUserToken, appUserToken } from '@db/schema'
import type { GeoSnapshot } from '@libs/platform/modules/geo/geo.type'
import type { DeviceInfo } from '@libs/platform/utils'

/**
 * Token 类型定义。
 * 1=访问令牌，2=刷新令牌。
 */
export enum TokenTypeEnum {
  /** 访问令牌。 */
  ACCESS = 1,
  /** 刷新令牌。 */
  REFRESH = 2,
}

/**
 * Token 实体接口
 * 定义 Token 数据的标准结构
 */
export type ITokenEntity =
  | typeof appUserToken.$inferSelect
  | typeof adminUserToken.$inferSelect

/**
 * 创建 Token 入参。
 * 用于持久化 access/refresh token 的核心字段。
 */
export interface CreateTokenInput extends GeoSnapshot {
  /** 用户 ID */
  userId: number
  /** JWT ID */
  jti: string
  /** Token 类型 */
  tokenType: TokenTypeEnum
  /** 过期时间 */
  expiresAt: Date
  /** 设备信息（结构化 JSON） */
  deviceInfo?: DeviceInfo | null
  /** IP 地址 */
  ipAddress?: string
  /** User-Agent */
  userAgent?: string
}

/**
 * Token 存储查询条件。
 */
export interface TokenStorageWhereInput {
  jti?: string | { in?: string[] }
  userId?: number
  revokedAt?: null | { not?: null; lt?: Date }
  expiresAt?: { gt?: Date; lt?: Date }
}

/**
 * Token 存储更新字段。
 */
export interface TokenStorageUpdateInput {
  revokedAt?: Date | null
  revokeReason?: number
}

/**
 * Token 批量查询选项。
 */
export interface TokenStorageFindManyOptions {
  select?: {
    jti?: boolean
  }
}

/**
 * Token Delegate 接口抽象
 * 适配 AdminUserToken 和 AppUserToken
 *
 * @template T Token 实体类型
 * @template CreateInput 创建参数类型
 * @template UpdateInput 更新参数类型
 * @template WhereInput 查询条件类型
 */
export interface ITokenDelegate<
  T,
  CreateInput = Record<string, never>,
  UpdateInput = Record<string, never>,
  WhereInput = Record<string, never>,
> {
  /** 创建单条记录 */
  create: (args: { data: CreateInput }) => Promise<T>
  /** 批量创建 */
  createMany: (args: { data: CreateInput[] }) => Promise<number>
  /** 查询单条 */
  findUnique: (args: {
    where: WhereInput & { jti?: string; id?: number }
  }) => Promise<T | null>
  /** 查询多条 */
  findMany: (args: {
    where?: WhereInput
    select?: { jti?: boolean }
  }) => Promise<T[]>
  /** 更新单条 */
  update: (args: { where: WhereInput; data: UpdateInput }) => Promise<T>
  /** 批量更新 */
  updateMany: (args: {
    where: WhereInput
    data: UpdateInput
  }) => Promise<number>
  /** 批量删除 */
  deleteMany: (args: { where: WhereInput }) => Promise<number>
}
