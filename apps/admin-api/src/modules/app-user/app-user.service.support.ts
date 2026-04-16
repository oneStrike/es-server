import type { DrizzleService } from '@db/core'
import type { AdminAppUserCountDto } from '@libs/user/dto/admin-app-user.dto'
import type { UserService as UserCoreService } from '@libs/user/user.service'
import { AdminUserRoleEnum } from '@libs/identity/admin-user.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  buildDateOnlyRangeInAppTimeZone,
  formatDateOnlyInAppTimeZone,
} from '@libs/platform/utils'
import { ForbiddenException } from '@nestjs/common'
import { eq } from 'drizzle-orm'

/**
 * APP 用户模块共享 support 基类。
 *
 * 统一收口管理端 APP 用户模块的底层表访问、权限校验、计数映射与通用 helper，
 * 供 facade 拆分后的 query / command / growth 子服务复用。
 */
export abstract class AppUserServiceSupport {
  constructor(
    protected readonly drizzle: DrizzleService,
    protected readonly userCoreService: UserCoreService,
  ) {}

  /** 数据库连接实例。 */
  protected get db() {
    return this.drizzle.db
  }

  /** APP 用户表。 */
  protected get appUserTable() {
    return this.drizzle.schema.appUser
  }

  /** 管理端用户表。 */
  protected get adminUserTable() {
    return this.drizzle.schema.adminUser
  }

  /** APP 用户计数表。 */
  protected get appUserCountTable() {
    return this.drizzle.schema.appUserCount
  }

  /** 用户等级规则表。 */
  protected get userLevelRuleTable() {
    return this.drizzle.schema.userLevelRule
  }

  /** 成长账本记录表。 */
  protected get growthLedgerRecordTable() {
    return this.drizzle.schema.growthLedgerRecord
  }

  /** 用户徽章分配表。 */
  protected get userBadgeAssignmentTable() {
    return this.drizzle.schema.userBadgeAssignment
  }

  /** 用户徽章表。 */
  protected get userBadgeTable() {
    return this.drizzle.schema.userBadge
  }

  /**
   * 按批次处理 ID 列表，避免全量修复类操作一次性压满数据库。
   */
  protected async processIdsInBatches(
    ids: number[],
    batchSize: number,
    handler: (batchIds: number[]) => Promise<void>,
  ) {
    for (let index = 0; index < ids.length; index += batchSize) {
      const batchIds = ids.slice(index, index + batchSize)
      await handler(batchIds)
    }
  }

  /**
   * 校验当前管理端用户是否为超级管理员。
   *
   * 已登录但角色不足时返回 `ForbiddenException`，避免前端误判为登录失效。
   */
  protected async ensureSuperAdmin(adminUserId: number) {
    const [adminUser] = await this.db
      .select({ role: this.adminUserTable.role })
      .from(this.adminUserTable)
      .where(eq(this.adminUserTable.id, adminUserId))
      .limit(1)

    if (!adminUser) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '管理端用户不存在',
      )
    }

    if (adminUser.role !== AdminUserRoleEnum.SUPER_ADMIN) {
      throw new ForbiddenException('权限不足')
    }
  }

  /**
   * 将共享用户计数读模型收敛为管理端 DTO 约定的输出结构。
   *
   * 运行时显式排除 `userId` 等内部字段，并为缺失值兜底为 0。
   */
  protected mapAdminAppUserCounts(counts?: Partial<AdminAppUserCountDto>) {
    return {
      commentCount: counts?.commentCount ?? 0,
      likeCount: counts?.likeCount ?? 0,
      favoriteCount: counts?.favoriteCount ?? 0,
      followingUserCount: counts?.followingUserCount ?? 0,
      followingAuthorCount: counts?.followingAuthorCount ?? 0,
      followingSectionCount: counts?.followingSectionCount ?? 0,
      followersCount: counts?.followersCount ?? 0,
      forumTopicCount: counts?.forumTopicCount ?? 0,
      commentReceivedLikeCount: counts?.commentReceivedLikeCount ?? 0,
      forumTopicReceivedLikeCount: counts?.forumTopicReceivedLikeCount ?? 0,
      forumTopicReceivedFavoriteCount:
        counts?.forumTopicReceivedFavoriteCount ?? 0,
    }
  }

  /** 构建日期范围查询条件。 */
  protected buildDateRange(startDate?: string, endDate?: string) {
    return buildDateOnlyRangeInAppTimeZone(startDate, endDate)
  }

  /**
   * 构建后台人工操作稳定业务键。
   *
   * 同一 `operationKey` 重试时保持 bizKey 不变，用于账本幂等和审计串联。
   */
  protected buildManualOperationBizKey(
    action: string,
    adminUserId: number,
    appUserId: number,
    operationKey: string,
  ) {
    return `${action}:admin:${adminUserId}:user:${appUserId}:operation:${operationKey}`
  }

  /**
   * 归一化出生日期输入。
   *
   * 支持保留 `undefined`、显式清空为 `null`，以及把 `Date` 收口为业务时区日期串。
   */
  protected normalizeBirthDate(value?: string | Date | null) {
    if (value === undefined) {
      return undefined
    }
    if (value === null || value === '') {
      return null
    }
    if (typeof value === 'string') {
      return value
    }
    return formatDateOnlyInAppTimeZone(value)
  }

  /**
   * 生成当前未占用的 6 位账号。
   *
   * 新建后台创建用户时仍沿用现有随机账号策略，避免与既有注册口径漂移。
   */
  protected async generateUniqueAccount() {
    const randomAccount = Math.floor(100000 + Math.random() * 900000)
    const [existingUser] = await this.db
      .select({ id: this.appUserTable.id })
      .from(this.appUserTable)
      .where(eq(this.appUserTable.account, String(randomAccount)))
      .limit(1)

    if (existingUser) {
      return this.generateUniqueAccount()
    }
    return randomAccount
  }
}
