import type { GeoSnapshot } from '@libs/platform/modules/geo/geo.type'
import type { DeviceInfo } from '@libs/platform/utils'
import type { RevokeTokenReasonEnum } from './auth.constant'

type JwtPayloadField =
  | string
  | number
  | boolean
  | null
  | Record<string, string | number | boolean | null>

/**
 * JWT 负载接口定义
 */
export interface JwtPayload {
  /** JWT ID */
  jti: string
  /** 受众 */
  aud: string
  /** 签发时间 */
  iat?: number
  /** 过期时间 */
  exp: number
  /** 生效时间 */
  nbf?: number
  /** 签发者 */
  iss?: string
  /** 主体 */
  sub?: string
  /** token 类型 */
  type?: string
  /** 其他扩展字段 */
  [key: string]: JwtPayloadField | undefined
}

/** 生成 token 时的输入载荷。 */
export interface TokenGenerateInput {
  /** 主体（用户 ID） */
  sub?: string
  /** 其他扩展字段 */
  [key: string]: JwtPayloadField | undefined
}

/** 认证层可见的最小 token 会话记录，不暴露具体持久化模型。 */
export interface TokenSessionRecord {
  jti: string
  expiresAt: Date
  revokedAt: Date | null
}

/** 认证层写入 token 会话所需的稳定数据。 */
export interface TokenSessionCreateInput extends GeoSnapshot {
  userId: number
  jti: string
  tokenType: TokenTypeEnum
  expiresAt: Date
  deviceInfo?: DeviceInfo | null
  ipAddress?: string
  userAgent?: string
}

/** 认证协议中的 token 类型。 */
export enum TokenTypeEnum {
  ACCESS = 1,
  REFRESH = 2,
}

/**
 * Token 存储服务接口
 */
export interface ITokenStorageService {
  /**
   * 根据 JTI 查询 Token
   * @param jti JWT Token ID
   * @returns Token 记录或 null
   */
  findByJti: (jti: string) => Promise<TokenSessionRecord | null>

  /**
   * 检查 Token 是否有效
   * 有效条件：Token 存在、未被撤销、未过期
   * @param jti JWT Token ID
   * @returns true=有效, false=无效
   */
  isTokenValid: (jti: string) => Promise<boolean>

  createToken: (data: TokenSessionCreateInput) => Promise<TokenSessionRecord>

  createTokens: (data: TokenSessionCreateInput[]) => Promise<number>

  revokeByJti: (
    jti: string,
    reason: RevokeTokenReasonEnum,
  ) => Promise<void> | void

  revokeByJtis: (
    jtis: string[],
    reason: RevokeTokenReasonEnum,
  ) => Promise<void> | void

  /**
   * 原子消费 token：仅当 token 未撤销且未过期时标记为已撤销。
   * 用于刷新 token 轮换，避免并发请求重复消费同一 refresh token。
   * @returns true 表示消费成功，false 表示 token 已失效或已被消费
   */
  consumeByJti: (jti: string, reason: RevokeTokenReasonEnum) => Promise<boolean>

  revokeAllByUserId: (
    userId: number,
    reason: RevokeTokenReasonEnum,
  ) => Promise<void> | void

  findActiveTokensByUserId: (userId: number) => Promise<TokenSessionRecord[]>

  /**
   * 清理过期 Token
   * @returns 清理数量
   */
  cleanupExpiredTokens: () => Promise<number>

  /**
   * 删除已撤销的旧 Token
   * @param retentionDays 保留天数
   * @returns 删除数量
   */
  deleteOldRevokedTokens: (retentionDays: number) => Promise<number>
}

/** 刷新 access token 时允许调用方提供 refresh token 原子消费钩子。 */
export interface RefreshAccessTokenOptions {
  consumeRefreshTokenJti?: (jti: string) => boolean | Promise<boolean>
}
