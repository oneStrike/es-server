import type { GeoSnapshot } from '@libs/platform/modules/geo/geo.types'
import type { JsonObject } from '@libs/platform/utils/jsonParse'

/**
 * Token 类型定义。
 * 1=访问令牌，2=刷新令牌。
 */
export enum TokenTypeEnum {
  ACCESS = 1,
  REFRESH = 2,
}

/**
 * Token 实体接口
 * 定义 Token 数据的标准结构
 */
/** 稳定领域类型 `ITokenEntity`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface ITokenEntity extends GeoSnapshot {
  /** 主键 */
  id: number
  /** JWT ID */
  jti: string
  /** 用户 ID */
  userId: number
  /** Token 类型 */
  tokenType: TokenTypeEnum
  /** 过期时间 */
  expiresAt: Date
  /** 撤销时间 */
  revokedAt?: Date | null
  /** 创建时间 */
  createdAt: Date
  /** 设备信息 */
  deviceInfo?: JsonObject | null
  /** IP 地址 */
  ipAddress?: string | null
  /** User-Agent */
  userAgent?: string | null
}

/**
 * 创建 Token 入参。
 * 用于持久化 access/refresh token 的核心字段。
 */
/** 稳定领域类型 `CreateTokenInput`。仅供内部领域/服务链路复用，避免重复定义。 */
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
  deviceInfo?: JsonObject | null
  /** IP 地址 */
  ipAddress?: string
  /** User-Agent */
  userAgent?: string
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
/** 稳定领域类型 `ITokenDelegate`。仅供内部领域/服务链路复用，避免重复定义。 */
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
    where: WhereInput & { jti?: string, id?: number }
  }) => Promise<T | null>
  /** 查询多条 */
  findMany: (args: {
    where?: WhereInput
    select?: { jti?: boolean }
  }) => Promise<T[]>
  /** 更新单条 */
  update: (args: { where: WhereInput, data: UpdateInput }) => Promise<T>
  /** 批量更新 */
  updateMany: (args: { where: WhereInput, data: UpdateInput }) => Promise<number>
  /** 批量删除 */
  deleteMany: (args: { where: WhereInput }) => Promise<number>
}
