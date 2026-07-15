import type {
  TokenSessionCreateInput,
  TokenSessionRecord,
} from '@libs/platform/modules/auth/types'
import type { Cache } from 'cache-manager'
import type { SQL } from 'drizzle-orm'
import type { TokenTable } from './drizzle-token-storage.type'
import type {
  TokenStorageFindManyOptions,
  TokenStorageUpdateInput,
  TokenStorageWhereInput,
} from './token-storage.type'
import { DrizzleService } from '@db/core'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject } from '@nestjs/common'
import { and, eq, gt, inArray, isNotNull, isNull, lt } from 'drizzle-orm'
import { BaseTokenStorageService } from './base-token-storage.service'

export abstract class BaseDrizzleTokenStorageService<
  TEntity extends TokenSessionRecord,
> extends BaseTokenStorageService<TEntity> {
  constructor(
    protected readonly drizzle: DrizzleService,
    @Inject(CACHE_MANAGER) cacheManager: Cache,
  ) {
    super(cacheManager)
  }

  protected abstract get tokenTable(): TokenTable

  protected async createOne(data: TokenSessionCreateInput) {
    const rows = await this.drizzle.withErrorHandling(
      () =>
        this.drizzle.db
          .insert(this.tokenTable)
          .values({
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
          })
          .returning({ id: this.tokenTable.id }),
      {
        duplicate: '登录状态创建失败，请重试',
      },
    )
    return rows[0] as TEntity & (typeof rows)[number]
  }

  protected async createManyItems(data: TokenSessionCreateInput[]) {
    const rows = await this.drizzle.withErrorHandling(
      () =>
        this.drizzle.db
          .insert(this.tokenTable)
          .values(
            data.map((token) => ({
              userId: token.userId,
              jti: token.jti,
              tokenType: token.tokenType,
              expiresAt: token.expiresAt,
              deviceInfo: token.deviceInfo,
              ipAddress: token.ipAddress,
              userAgent: token.userAgent,
              geoCountry: token.geoCountry,
              geoProvince: token.geoProvince,
              geoCity: token.geoCity,
              geoIsp: token.geoIsp,
              geoSource: token.geoSource,
            })),
          )
          .returning({ id: this.tokenTable.id }),
      {
        duplicate: '登录状态创建失败，请重试',
      },
    )
    return rows.length
  }

  protected async findOneByJti(jti: string) {
    const [token] = await this.drizzle.db
      .select({
        revokedAt: this.tokenTable.revokedAt,
        expiresAt: this.tokenTable.expiresAt,
      })
      .from(this.tokenTable)
      .where(eq(this.tokenTable.jti, jti))
      .limit(1)
    return (token as TEntity) ?? null
  }

  protected async updateManyItems(
    where: TokenStorageWhereInput,
    data: TokenStorageUpdateInput,
  ) {
    const condition = this.buildWhere(where)
    const rows = await this.drizzle.withErrorHandling(() =>
      this.drizzle.db
        .update(this.tokenTable)
        .set(data as Record<string, string | number | Date | null | object>)
        .where(condition)
        .returning({ id: this.tokenTable.id }),
    )
    return rows.length
  }

  protected async findManyItems(
    where: TokenStorageWhereInput,
    _options?: TokenStorageFindManyOptions,
  ) {
    const condition = this.buildWhere(where)

    return this.drizzle.db
      .select({ jti: this.tokenTable.jti })
      .from(this.tokenTable)
      .where(condition) as Promise<TEntity[]>
  }

  protected async deleteManyItems(where: TokenStorageWhereInput) {
    const condition = this.buildWhere(where)
    const rows = await this.drizzle.withErrorHandling(() =>
      this.drizzle.db
        .delete(this.tokenTable)
        .where(condition)
        .returning({ id: this.tokenTable.id }),
    )
    return rows.length
  }

  private buildWhere(where: TokenStorageWhereInput) {
    const conditions: SQL[] = []

    if (where.jti) {
      if (typeof where.jti === 'string') {
        conditions.push(eq(this.tokenTable.jti, where.jti))
      } else if (where.jti.in) {
        conditions.push(inArray(this.tokenTable.jti, where.jti.in))
      }
    }

    if (typeof where.userId === 'number') {
      conditions.push(eq(this.tokenTable.userId, where.userId))
    }

    if (where.revokedAt === null) {
      conditions.push(isNull(this.tokenTable.revokedAt))
    } else if (where.revokedAt?.not === null) {
      conditions.push(isNotNull(this.tokenTable.revokedAt))
    }

    if (where.expiresAt?.gt) {
      conditions.push(gt(this.tokenTable.expiresAt, where.expiresAt.gt))
    }
    if (where.expiresAt?.lt) {
      conditions.push(lt(this.tokenTable.expiresAt, where.expiresAt.lt))
    }

    if (where.revokedAt?.lt) {
      conditions.push(lt(this.tokenTable.revokedAt, where.revokedAt.lt))
    }

    return conditions.length === 1 ? conditions[0] : and(...conditions)
  }
}
