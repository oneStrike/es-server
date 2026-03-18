import type { Cache } from 'cache-manager'
import { DrizzleService } from '@db/core'
import { CreateTokenDto } from '@libs/platform/modules/auth'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, gt, inArray, isNotNull, isNull, lt } from 'drizzle-orm'

/**
 * 应用层 Token 存储服务
 */
@Injectable()
export class AppTokenStorageService {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private get tokenTable() {
    return this.drizzle.schema.appUserToken
  }

  private get db() {
    return this.drizzle.db
  }

  private getTokenTtlMs(expiresAt: Date) {
    return Math.max(0, Math.floor(expiresAt.getTime() - Date.now()))
  }

  async createToken(data: CreateTokenDto) {
    const [result] = await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.tokenTable)
        .values({
          userId: data.userId,
          jti: data.jti,
          tokenType: data.tokenType,
          expiresAt: data.expiresAt,
          deviceInfo: data.deviceInfo as any,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        })
        .returning(),
    )
    const ttlMs = this.getTokenTtlMs(data.expiresAt)
    if (ttlMs > 0) {
      await this.cacheManager.set(`token:${data.jti}`, 'valid', ttlMs)
    }
    return result
  }

  async createTokens(tokens: CreateTokenDto[]) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.tokenTable)
        .values(
          tokens.map((token) => ({
            userId: token.userId,
            jti: token.jti,
            tokenType: token.tokenType,
            expiresAt: token.expiresAt,
            deviceInfo: token.deviceInfo as any,
            ipAddress: token.ipAddress,
            userAgent: token.userAgent,
          })),
        )
        .returning({ id: this.tokenTable.id }),
    )
    await Promise.all(
      tokens.map(async (token) => {
        const ttlMs = this.getTokenTtlMs(token.expiresAt)
        if (ttlMs > 0) {
          await this.cacheManager.set(`token:${token.jti}`, 'valid', ttlMs)
        }
      }),
    )
    return { count: result.length }
  }

  async findByJti(jti: string) {
    const [token] = await this.db
      .select()
      .from(this.tokenTable)
      .where(eq(this.tokenTable.jti, jti))
      .limit(1)
    return token
  }

  async isTokenValid(jti: string): Promise<boolean> {
    const cached = await this.cacheManager.get(`token:${jti}`)
    if (cached !== null && cached !== undefined) {
      return cached === 'valid'
    }
    const token = await this.findByJti(jti)
    if (!token || token.revokedAt || new Date() > token.expiresAt) {
      await this.cacheManager.set(`token:${jti}`, 'invalid', 24 * 60 * 60 * 1000)
      return false
    }
    const ttlMs = this.getTokenTtlMs(token.expiresAt)
    if (ttlMs <= 0) {
      await this.cacheManager.set(`token:${jti}`, 'invalid', 24 * 60 * 60 * 1000)
      return false
    }
    await this.cacheManager.set(`token:${jti}`, 'valid', ttlMs)
    return true
  }

  async revokeByJti(jti: string, reason: string) {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.tokenTable)
        .set({
          revokedAt: new Date(),
          revokeReason: reason,
        })
        .where(eq(this.tokenTable.jti, jti)),
    )
    await this.cacheManager.set(`token:${jti}`, 'invalid', 24 * 60 * 60 * 1000)
  }

  async revokeByJtis(jtis: string[], reason: string) {
    if (jtis.length === 0) {
      return
    }
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.tokenTable)
        .set({
          revokedAt: new Date(),
          revokeReason: reason,
        })
        .where(inArray(this.tokenTable.jti, jtis)),
    )
    await Promise.all(
      jtis.map(async (jti) =>
        this.cacheManager.set(`token:${jti}`, 'invalid', 24 * 60 * 60 * 1000),
      ),
    )
  }

  async revokeAllByUserId(userId: number, reason: string) {
    const tokens = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const activeTokens = await tx
          .select({ jti: this.tokenTable.jti })
          .from(this.tokenTable)
          .where(
            and(eq(this.tokenTable.userId, userId), isNull(this.tokenTable.revokedAt)),
          )
        await tx
          .update(this.tokenTable)
          .set({
            revokedAt: new Date(),
            revokeReason: reason,
          })
          .where(
            and(eq(this.tokenTable.userId, userId), isNull(this.tokenTable.revokedAt)),
          )
        return activeTokens
      }),
    )
    await Promise.all(
      tokens.map(async (token) =>
        this.cacheManager.set(
          `token:${token.jti}`,
          'invalid',
          24 * 60 * 60 * 1000,
        ),
      ),
    )
  }

  async findActiveTokensByUserId(userId: number) {
    return this.db
      .select()
      .from(this.tokenTable)
      .where(
        and(
          eq(this.tokenTable.userId, userId),
          isNull(this.tokenTable.revokedAt),
          gt(this.tokenTable.expiresAt, new Date()),
        ),
      )
  }

  async cleanupExpiredTokens() {
    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.tokenTable)
        .set({
          revokedAt: new Date(),
          revokeReason: 'TOKEN_EXPIRED',
        })
        .where(
          and(
            lt(this.tokenTable.expiresAt, new Date()),
            isNull(this.tokenTable.revokedAt),
          ),
        )
        .returning({ id: this.tokenTable.id }),
    )
    return rows.length
  }

  async deleteOldRevokedTokens(retentionDays: number = 30) {
    const date = new Date()
    date.setDate(date.getDate() - retentionDays)
    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .delete(this.tokenTable)
        .where(
          and(
            lt(this.tokenTable.revokedAt, date),
            isNotNull(this.tokenTable.revokedAt),
          ),
        )
        .returning({ id: this.tokenTable.id }),
    )
    return rows.length
  }
}

export type { CreateTokenDto }
