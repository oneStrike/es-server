import type { Cache } from 'cache-manager'
import type { RevokeTokenReasonEnum } from './auth.constant'
import type { ITokenStorageService, TokenSessionCreateInput } from './auth.type'
import type { TokenSessionPersistencePort } from './token-persistence.port'

const INVALID_TOKEN_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** 组合持久化端口与缓存语义的通用 token 存储基类。 */
export class BaseTokenStorageService implements ITokenStorageService {
  constructor(
    protected readonly persistence: TokenSessionPersistencePort,
    protected readonly cacheManager: Cache,
  ) {}

  /** 创建单条 token 并同步写入有效缓存。 */
  async createToken(data: TokenSessionCreateInput) {
    const result = await this.persistence.createOne(data)
    await this.cacheValidToken(data.jti, data.expiresAt)
    return result
  }

  /** 批量创建 token 并为每条记录建立缓存命中标记。 */
  async createTokens(tokens: TokenSessionCreateInput[]) {
    const result = await this.persistence.createMany(tokens)
    await Promise.all(
      tokens.map(async (token) =>
        this.cacheValidToken(token.jti, token.expiresAt),
      ),
    )
    return result
  }

  /** 按 JTI 查询 token。 */
  async findByJti(jti: string) {
    return this.persistence.findByJti(jti)
  }

  /**
   * 判断 token 当前是否有效。
   * 有效状态必须回源数据库，避免用户级批量撤销后旧的 valid 缓存继续放行。
   */
  async isTokenValid(jti: string): Promise<boolean> {
    const cached = await this.cacheManager.get(`token:${jti}`)
    if (cached === 'invalid') {
      return false
    }

    const token = await this.findByJti(jti)
    if (!token || token.revokedAt || new Date() > token.expiresAt) {
      await this.cacheInvalidToken(jti)
      return false
    }

    const cachedAsValid = await this.cacheValidToken(jti, token.expiresAt)
    if (cachedAsValid) {
      return true
    }

    await this.cacheInvalidToken(jti)
    return false
  }

  /** 按 JTI 撤销单条 token，并立即写入无效缓存。 */
  async revokeByJti(jti: string, reason: RevokeTokenReasonEnum) {
    await this.revokeByJtis([jti], reason)
  }

  /** 批量撤销多条 token，并同步写入无效缓存。 */
  async revokeByJtis(jtis: string[], reason: RevokeTokenReasonEnum) {
    if (jtis.length === 0) {
      return
    }

    await this.persistence.revokeByJtis(jtis, reason)
    await Promise.all(jtis.map(async (jti) => this.cacheInvalidToken(jti)))
  }

  /** 原子消费 refresh token，返回值用于上层判断是否允许继续刷新。 */
  async consumeByJti(
    jti: string,
    reason: RevokeTokenReasonEnum,
  ): Promise<boolean> {
    const consumed = await this.persistence.consumeByJti(jti, reason)
    await this.cacheInvalidToken(jti)
    return consumed
  }

  /** 撤销指定用户的全部未撤销 token，包含已过期但尚未回收的会话。 */
  async revokeAllByUserId(userId: number, reason: RevokeTokenReasonEnum) {
    const jtis = await this.persistence.revokeAllUnrevokedByUserId(
      userId,
      reason,
    )
    await Promise.all(jtis.map(async (jti) => this.cacheInvalidToken(jti)))
  }

  /** 查询指定用户当前仍有效的 token 列表。 */
  async findActiveTokensByUserId(userId: number) {
    return this.persistence.findActiveByUserId(userId)
  }

  /** 将已过期但尚未标记撤销的 token 批量回收。 */
  async cleanupExpiredTokens() {
    return this.persistence.cleanupExpired()
  }

  /** 删除保留期之前的已撤销 token 记录。 */
  async deleteOldRevokedTokens(retentionDays: number = 30) {
    return this.persistence.deleteOldRevoked(retentionDays)
  }

  // 将过期时间转换为缓存 TTL，已过期 token 归零避免写入有效缓存。
  private getTokenTtlMs(expiresAt: Date) {
    return Math.max(0, Math.floor(expiresAt.getTime() - Date.now()))
  }

  // 仅缓存未过期 token 的有效标记，TTL 与 token 剩余有效期一致。
  private async cacheValidToken(jti: string, expiresAt: Date) {
    const ttlMs = this.getTokenTtlMs(expiresAt)
    if (ttlMs <= 0) {
      return false
    }

    await this.cacheManager.set(`token:${jti}`, 'valid', ttlMs)
    return true
  }

  // 缓存无效标记用于快速拒绝，固定短期保留覆盖撤销后的重复校验。
  private async cacheInvalidToken(jti: string) {
    await this.cacheManager.set(
      `token:${jti}`,
      'invalid',
      INVALID_TOKEN_CACHE_TTL_MS,
    )
  }
}
