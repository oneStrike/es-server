/**
 * Token 类型定义
 * 统一管理 Token 类型字面量
 */
export type TokenType = 'ACCESS' | 'REFRESH'

/**
 * Token 实体接口
 * 定义 Token 数据的标准结构
 */
export interface ITokenEntity {
  /** 主键 */
  id: number
  /** JWT ID */
  jti: string
  /** 用户 ID */
  userId: number
  /** Token 类型 */
  tokenType: string
  /** 过期时间 */
  expiresAt: Date
  /** 撤销时间 */
  revokedAt?: Date | null
  /** 创建时间 */
  createdAt: Date
  /** 设备信息 */
  deviceInfo?: any
  /** IP 地址 */
  ipAddress?: string | null
  /** User-Agent */
  userAgent?: string | null
}

/**
 * 创建 Token 数据传输对象
 */
export interface CreateTokenDto {
  /** 用户 ID */
  userId: number
  /** JWT ID */
  jti: string
  /** Token 类型 */
  tokenType: TokenType
  /** 过期时间 */
  expiresAt: Date
  /** 设备信息（序列化） */
  deviceInfo?: string
  /** IP 地址 */
  ipAddress?: string
  /** User-Agent */
  userAgent?: string
}

/**
 * Prisma Delegate 接口抽象
 * 适配 AdminUserToken 和 AppUserToken
 *
 * @template T Token 实体类型
 * @template CreateInput 创建参数类型
 * @template UpdateInput 更新参数类型
 * @template WhereInput 查询条件类型
 */
export interface ITokenDelegate<
  T,
  CreateInput = any,
  UpdateInput = any,
  WhereInput = any,
> {
  /** 创建单条记录 */
  create: (args: { data: CreateInput }) => Promise<T>
  /** 批量创建 */
  createMany: (args: { data: CreateInput[] }) => Promise<any>
  /** 查询单条 */
  findUnique: (args: {
    where: WhereInput & { jti?: string, id?: number }
  }) => Promise<T | null>
  /** 查询多条 */
  findMany: (args: { where?: WhereInput, [key: string]: any }) => Promise<T[]>
  /** 更新单条 */
  update: (args: { where: WhereInput, data: UpdateInput }) => Promise<T>
  /** 批量更新 */
  updateMany: (args: { where: WhereInput, data: UpdateInput }) => Promise<any>
  /** 批量删除 */
  deleteMany: (args: { where: WhereInput }) => Promise<any>
}
