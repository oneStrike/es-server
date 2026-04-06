import type { CreateTokenInput, ITokenEntity } from '@libs/platform/modules/auth/token-storage.types';
import type { Cache } from 'cache-manager'
import { DrizzleService } from '@db/core'
import { BaseTokenStorageService } from '@libs/platform/modules/auth/base-token-storage.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject } from '@nestjs/common'
import { and, eq, gt, inArray, isNotNull, isNull, lt } from 'drizzle-orm'

type WhereInput = Record<string, any>

export abstract class BaseDrizzleTokenStorageService<
  TEntity extends ITokenEntity,
> extends BaseTokenStorageService<TEntity> {
  constructor(
    protected readonly drizzle: DrizzleService,
    @Inject(CACHE_MANAGER) cacheManager: Cache,
  ) {
    super(cacheManager)
  }

  protected abstract get tokenTable(): any

  protected async createOne(data: CreateTokenInput) {
    const rows = await this.drizzle.withErrorHandling(
      () =>
        this.drizzle.db
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
      {
        duplicate: '登录状态创建失败，请重试',
      },
    )
    return rows[0] as TEntity
  }

  protected async createManyItems(data: CreateTokenInput[]) {
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
              deviceInfo: token.deviceInfo as any,
              ipAddress: token.ipAddress,
              userAgent: token.userAgent,
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
      .select()
      .from(this.tokenTable)
      .where(eq(this.tokenTable.jti, jti))
      .limit(1)
    return (token as TEntity) ?? null
  }

  protected async updateManyItems(where: WhereInput, data: WhereInput) {
    const condition = this.buildWhere(where)
    const rows = await this.drizzle.withErrorHandling(() =>
      this.drizzle.db
        .update(this.tokenTable)
        .set(data as any)
        .where(condition)
        .returning({ id: this.tokenTable.id }),
    )
    return rows.length
  }

  protected async findManyItems(where: WhereInput, options?: WhereInput) {
    const condition = this.buildWhere(where)

    if (options?.select?.jti) {
      return this.drizzle.db
        .select({ jti: this.tokenTable.jti })
        .from(this.tokenTable)
        .where(condition) as any
    }

    return this.drizzle.db
      .select()
      .from(this.tokenTable)
      .where(condition) as any
  }

  protected async deleteManyItems(where: WhereInput) {
    const condition = this.buildWhere(where)
    const rows = await this.drizzle.withErrorHandling(() =>
      this.drizzle.db
        .delete(this.tokenTable)
        .where(condition)
        .returning({ id: this.tokenTable.id }),
    )
    return rows.length
  }

  private buildWhere(where: WhereInput) {
    const conditions: any[] = []

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
