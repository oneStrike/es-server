import type { Cache } from 'cache-manager'
import type { ITokenStorageService } from './auth.types'
import type {
  CreateTokenInput,
  ITokenEntity,
  TokenStorageFindManyOptions,
  TokenStorageUpdateInput,
  TokenStorageWhereInput,
} from './token-storage.types'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { RevokeTokenReasonEnum } from './auth.constant'

const INVALID_TOKEN_CACHE_TTL_MS = 24 * 60 * 60 * 1000

@Injectable()
export abstract class BaseTokenStorageService<T extends ITokenEntity>
  implements ITokenStorageService
{
  constructor(@Inject(CACHE_MANAGER) protected readonly cacheManager: Cache) {}

  /** 创建单条 token 记录，具体落库由子类实现。 */
  protected abstract createOne(data: CreateTokenInput): Promise<T>

  /** 批量创建 token 记录，返回写入条数。 */
  protected abstract createManyItems(data: CreateTokenInput[]): Promise<number>

  /** 按 jti 查询单条 token 记录。 */
  protected abstract findOneByJti(jti: string): Promise<T | null>

  /** 按条件批量更新 token 记录。 */
  protected abstract updateManyItems(
    where: TokenStorageWhereInput,
    data: TokenStorageUpdateInput,
  ): Promise<number>

  /** 按条件批量查询 token 记录。 */
  protected abstract findManyItems(
    where: TokenStorageWhereInput,
    options?: TokenStorageFindManyOptions,
  ): Promise<T[]>

  /** 按条件批量删除 token 记录。 */
  protected abstract deleteManyItems(where: TokenStorageWhereInput): Promise<number>

  /** 计算 token 距离过期的剩余毫秒数，供缓存 TTL 复用。 */
  private getTokenTtlMs(expiresAt: Date) {
    return Math.max(0, Math.floor(expiresAt.getTime() - Date.now()))
  }

  /** 创建单条 token 并同步写入缓存命中标记。 */
  async createToken(data: CreateTokenInput) {
    const result = await this.createOne(data)
    const ttlMs = this.getTokenTtlMs(data.expiresAt)
    if (ttlMs > 0) {
      await this.cacheManager.set(`token:${data.jti}`, 'valid', ttlMs)
    }
    return result
  }

  /** 批量创建 token 并为每条记录建立缓存命中标记。 */
  async createTokens(tokens: CreateTokenInput[]) {
    const result = await this.createManyItems(tokens)
    await Promise.all(
      tokens.map(async (token) => {
        const ttlMs = this.getTokenTtlMs(token.expiresAt)
        if (ttlMs > 0) {
          await this.cacheManager.set(`token:${token.jti}`, 'valid', ttlMs)
        }
      }),
    )
    return result
  }

  /** 按 jti 查询 token。 */
  async findByJti(jti: string) {
    return this.findOneByJti(jti)
  }

  /**
   * 判断 token 当前是否有效。
   * 先读缓存，再回落数据库；无效结果会写入短期缓存，避免频繁命中数据库。
   */
  async isTokenValid(jti: string): Promise<boolean> {
    const cached = await this.cacheManager.get(`token:${jti}`)
    if (cached !== null && cached !== undefined) {
      return cached === 'valid'
    }

    const token = await this.findByJti(jti)
    if (!token) {
      await this.cacheManager.set(`token:${jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS)
      return false
    }

    if (token.revokedAt) {
      await this.cacheManager.set(`token:${jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS)
      return false
    }

    if (new Date() > token.expiresAt) {
      await this.cacheManager.set(`token:${jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS)
      return false
    }

    const ttlMs = this.getTokenTtlMs(token.expiresAt)
    if (ttlMs > 0) {
      await this.cacheManager.set(`token:${jti}`, 'valid', ttlMs)
      return true
    }

    await this.cacheManager.set(`token:${jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS)
    return false
  }

  /** 按 jti 撤销单条 token，并立即写入无效缓存。 */
  async revokeByJti(jti: string, reason: RevokeTokenReasonEnum) {
    await this.updateManyItems(
      { jti },
      {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    )
    await this.cacheManager.set(`token:${jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS)
  }

  /** 批量撤销多条 token，并同步写入无效缓存。 */
  async revokeByJtis(jtis: string[], reason: RevokeTokenReasonEnum) {
    await this.updateManyItems(
      { jti: { in: jtis } },
      {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    )
    await Promise.all(
      jtis.map(async (jti) =>
        this.cacheManager.set(`token:${jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS),
      ),
    )
  }

  /**
   * 原子消费 refresh token。
   * 仅未撤销且未过期的记录可被成功消费，返回值用于上层判断是否允许继续刷新。
   */
  async consumeByJti(
    jti: string,
    reason: RevokeTokenReasonEnum,
  ): Promise<boolean> {
    const affectedRows = await this.updateManyItems(
      {
        jti,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    )
    await this.cacheManager.set(`token:${jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS)
    return affectedRows > 0
  }

  /** 撤销指定用户的全部有效 token。 */
  async revokeAllByUserId(userId: number, reason: RevokeTokenReasonEnum) {
    const tokens = await this.findManyItems({
      userId,
      revokedAt: null,
    }, {
      select: {
        jti: true,
      },
    })

    await this.updateManyItems(
      {
        userId,
        revokedAt: null,
      },
      {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    )

    await Promise.all(
      tokens.map(async (token) =>
        this.cacheManager.set(`token:${token.jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS),
      ),
    )
  }

  /** 查询指定用户当前仍有效的 token 列表。 */
  async findActiveTokensByUserId(userId: number) {
    return this.findManyItems({
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    })
  }

  /** 将已过期但尚未标记撤销的 token 批量回收。 */
  async cleanupExpiredTokens() {
    return this.updateManyItems(
      {
        expiresAt: { lt: new Date() },
        revokedAt: null,
      },
      {
        revokedAt: new Date(),
        revokeReason: RevokeTokenReasonEnum.TOKEN_EXPIRED,
      },
    )
  }

  /** 删除保留期之前的已撤销 token 记录。 */
  async deleteOldRevokedTokens(retentionDays: number = 30) {
    const date = new Date()
    date.setDate(date.getDate() - retentionDays)
    return this.deleteManyItems({
      revokedAt: {
        not: null,
        lt: date,
      },
    })
  }
}
