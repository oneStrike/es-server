import type { RevokeTokenReasonEnum } from './auth.constant'

type JwtPayloadField =
  | string
  | number
  | boolean
  | null
  | Record<string, string | number | boolean | null>

/**
 * JWT负载接口定义
 */
export interface JwtPayload {
  /** JWT ID */
  jti: string
  /** 受众 */
  aud: string
  /** 其他扩展字段 */
  [key: string]: JwtPayloadField
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
  findByJti: (jti: string) => Promise<object | null>

  /**
   * 检查 Token 是否有效
   * 有效条件：Token 存在、未被撤销、未过期
   * @param jti JWT Token ID
   * @returns true=有效, false=无效
   */
  isTokenValid: (jti: string) => Promise<boolean>

  createToken: (data: object) => Promise<object>

  createTokens: (data: object[]) => Promise<object | number>

  revokeByJti: (jti: string, reason: RevokeTokenReasonEnum) => Promise<void> | void

  revokeByJtis: (jtis: string[], reason: RevokeTokenReasonEnum) => Promise<void> | void

  /**
   * 原子消费 token：仅当 token 未撤销且未过期时标记为已撤销。
   * 用于刷新 token 轮换，避免并发请求重复消费同一 refresh token。
   * @returns true 表示消费成功，false 表示 token 已失效或已被消费
   */
  consumeByJti: (jti: string, reason: RevokeTokenReasonEnum) => Promise<boolean>

  revokeAllByUserId: (userId: number, reason: RevokeTokenReasonEnum) => Promise<void> | void

  findActiveTokensByUserId: (userId: number) => Promise<object[]>

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
