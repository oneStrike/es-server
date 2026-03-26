import type { Cache } from 'cache-manager'
import type { ITokenStorageService } from './auth.types'
import type {
  CreateTokenInput,
  ITokenEntity,
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

  protected abstract createOne(data: CreateTokenInput): Promise<T>

  protected abstract createManyItems(data: CreateTokenInput[]): Promise<number>

  protected abstract findOneByJti(jti: string): Promise<T | null>

  protected abstract updateManyItems(
    where: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Promise<number>

  protected abstract findManyItems(
    where: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<T[]>

  protected abstract deleteManyItems(where: Record<string, unknown>): Promise<number>

  private getTokenTtlMs(expiresAt: Date) {
    return Math.max(0, Math.floor(expiresAt.getTime() - Date.now()))
  }

  async createToken(data: CreateTokenInput) {
    const result = await this.createOne(data)
    const ttlMs = this.getTokenTtlMs(data.expiresAt)
    if (ttlMs > 0) {
      await this.cacheManager.set(`token:${data.jti}`, 'valid', ttlMs)
    }
    return result
  }

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

  async findByJti(jti: string) {
    return this.findOneByJti(jti)
  }

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

  async findActiveTokensByUserId(userId: number) {
    return this.findManyItems({
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    })
  }

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
