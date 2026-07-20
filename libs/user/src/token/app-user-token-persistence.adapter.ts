import type {
  TokenSessionCreateInput,
  TokenSessionPersistencePort,
  TokenSessionRecord,
} from '@libs/platform/modules/auth/types'
import { DrizzleService } from '@db/core'
import { RevokeTokenReasonEnum } from '@libs/platform/modules/auth/helpers'
import { Injectable } from '@nestjs/common'
import { and, eq, gt, inArray, isNotNull, isNull, lt } from 'drizzle-orm'

/** app_user_token 表的 token 会话持久化适配器。 */
@Injectable()
export class AppUserTokenPersistenceAdapter implements TokenSessionPersistencePort {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get tokenTable() {
    return this.drizzle.schema.appUserToken
  }

  /** 创建单条 APP 用户 token 会话。 */
  async createOne(data: TokenSessionCreateInput) {
    const [token] = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .insert(this.tokenTable)
          .values(this.toInsertValue(data))
          .returning({
            jti: this.tokenTable.jti,
            expiresAt: this.tokenTable.expiresAt,
            revokedAt: this.tokenTable.revokedAt,
          }),
      {
        duplicate: '登录状态创建失败，请重试',
      },
    )
    return token
  }

  /** 批量创建 APP 用户 token 会话。 */
  async createMany(data: TokenSessionCreateInput[]) {
    const rows = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .insert(this.tokenTable)
          .values(data.map((token) => this.toInsertValue(token)))
          .returning({ id: this.tokenTable.id }),
      {
        duplicate: '登录状态创建失败，请重试',
      },
    )
    return rows.length
  }

  /** 按 JTI 查询最小 token 会话记录。 */
  async findByJti(jti: string): Promise<TokenSessionRecord | null> {
    const [token] = await this.db
      .select({
        jti: this.tokenTable.jti,
        revokedAt: this.tokenTable.revokedAt,
        expiresAt: this.tokenTable.expiresAt,
      })
      .from(this.tokenTable)
      .where(eq(this.tokenTable.jti, jti))
      .limit(1)
    return token ?? null
  }

  /** 原子消费仍有效的 token 会话。 */
  async consumeByJti(jti: string, reason: RevokeTokenReasonEnum) {
    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.tokenTable)
        .set({
          revokedAt: new Date(),
          revokeReason: reason,
        })
        .where(
          and(
            eq(this.tokenTable.jti, jti),
            isNull(this.tokenTable.revokedAt),
            gt(this.tokenTable.expiresAt, new Date()),
          ),
        )
        .returning({ id: this.tokenTable.id }),
    )
    return rows.length > 0
  }

  /** 批量撤销指定 JTI 的 token 会话。 */
  async revokeByJtis(jtis: string[], reason: RevokeTokenReasonEnum) {
    if (jtis.length === 0) {
      return 0
    }

    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.tokenTable)
        .set({
          revokedAt: new Date(),
          revokeReason: reason,
        })
        .where(inArray(this.tokenTable.jti, jtis))
        .returning({ id: this.tokenTable.id }),
    )
    return rows.length
  }

  /** 查询指定 APP 用户当前仍有效的 token 会话。 */
  async findActiveByUserId(userId: number) {
    return this.db
      .select({
        jti: this.tokenTable.jti,
        expiresAt: this.tokenTable.expiresAt,
        revokedAt: this.tokenTable.revokedAt,
      })
      .from(this.tokenTable)
      .where(
        and(
          eq(this.tokenTable.userId, userId),
          isNull(this.tokenTable.revokedAt),
          gt(this.tokenTable.expiresAt, new Date()),
        ),
      )
  }

  /** 撤销指定 APP 用户全部未撤销 token，并返回撤销前选中的 JTI。 */
  async revokeAllUnrevokedByUserId(
    userId: number,
    reason: RevokeTokenReasonEnum,
  ) {
    const tokens = await this.db
      .select({ jti: this.tokenTable.jti })
      .from(this.tokenTable)
      .where(
        and(
          eq(this.tokenTable.userId, userId),
          isNull(this.tokenTable.revokedAt),
        ),
      )

    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.tokenTable)
        .set({
          revokedAt: new Date(),
          revokeReason: reason,
        })
        .where(
          and(
            eq(this.tokenTable.userId, userId),
            isNull(this.tokenTable.revokedAt),
          ),
        ),
    )

    return tokens.map((token) => token.jti)
  }

  /** 标记过期 APP 用户 token 会话为已撤销。 */
  async cleanupExpired() {
    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.tokenTable)
        .set({
          revokedAt: new Date(),
          revokeReason: RevokeTokenReasonEnum.TOKEN_EXPIRED,
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

  /** 删除保留期之前的已撤销 APP 用户 token 会话。 */
  async deleteOldRevoked(retentionDays: number) {
    const date = new Date()
    date.setDate(date.getDate() - retentionDays)

    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .delete(this.tokenTable)
        .where(
          and(
            isNotNull(this.tokenTable.revokedAt),
            lt(this.tokenTable.revokedAt, date),
          ),
        )
        .returning({ id: this.tokenTable.id }),
    )
    return rows.length
  }

  // 将跨平台 token 创建输入收敛为 app_user_token 表可写字段。
  private toInsertValue(data: TokenSessionCreateInput) {
    return {
      userId: data.userId,
      jti: data.jti,
      tokenType: data.tokenType,
      expiresAt: data.expiresAt,
      deviceInfo: data.deviceInfo,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      geoCountry: data.geoCountry,
      geoProvince: data.geoProvince,
      geoCity: data.geoCity,
      geoIsp: data.geoIsp,
      geoSource: data.geoSource,
    }
  }
}
