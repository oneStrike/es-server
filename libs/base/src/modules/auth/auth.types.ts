/**
 * JWT负载接口定义
 */
export interface JwtPayload {
  /** JWT ID */
  jti: string
  /** 受众 */
  aud: string
  /** 其他扩展字段 */
  [key: string]: any
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
  findByJti: (jti: string) => Promise<any>

  /**
   * 检查 Token 是否有效
   * 有效条件：Token 存在、未被撤销、未过期
   * @param jti JWT Token ID
   * @returns true=有效, false=无效
   */
  isTokenValid: (jti: string) => Promise<boolean>

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
