import type { AppUserSelect } from '@db/schema'
import type { AppUserCountSnapshot } from './app-user-count.type'
import type {
  AppUserAccessCheckResult,
  UserBanAccessSource,
  UserBanGuardSource,
  UserGrowthSnapshot,
  UserMentionCandidatePageResult,
  UserStatusSource,
} from './user.type'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { GrowthAssetTypeEnum } from '@libs/growth/growth-ledger/growth-ledger.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { formatDateTimeInAppTimeZone } from '@libs/platform/utils'
import {
  AppUserAccessMessages,
  UserStatusEnum,
} from '@libs/user/app-user.constant'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { AppUserCountService } from './app-user-count.service'
import { AppUserResponseDto } from './dto/base-app-user.dto'
import {
  QueryUserMentionPageDto,
  UserLevelSummaryDto,
  UserMentionCandidateDto,
  UserStatusSummaryDto,
} from './dto/user-self.dto'

/**
 * 用户域共享服务。
 * 负责收敛 app_user 的存在性校验、状态语义和对外字段映射，
 * 避免 app/admin 两侧各自维护一套用户基础规则。
 */
@Injectable()
export class UserService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly appUserCountService: AppUserCountService,
  ) {}

  // 复用当前模块共享数据库连接。
  private get db() {
    return this.drizzle.db
  }

  // 复用应用用户表。
  private get appUser() {
    return this.drizzle.schema.appUser
  }

  // 复用等级规则表。
  private get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  // 复用用户徽章分配表。
  private get userBadgeAssignment() {
    return this.drizzle.schema.userBadgeAssignment
  }

  // 复用用户资产余额表。
  private get userAssetBalance() {
    return this.drizzle.schema.userAssetBalance
  }

  // 确保用户存在。
  async ensureUserExists(userId: number): Promise<AppUserSelect> {
    const [user] = await this.db
      .select()
      .from(this.appUser)
      .where(and(eq(this.appUser.id, userId), isNull(this.appUser.deletedAt)))
      .limit(1)
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '应用用户不存在',
      )
    }
    return user
  }

  // 获取用户基础信息。
  async findById(userId: number): Promise<AppUserSelect | undefined> {
    const [user] = await this.db
      .select()
      .from(this.appUser)
      .where(and(eq(this.appUser.id, userId), isNull(this.appUser.deletedAt)))
      .limit(1)
    return user
  }

  // 检查 APP 用户是否可访问应用入口。
  // 只返回稳定状态结果，不抛 HTTP / WS 协议异常，避免入口层语义互相泄漏。
  async getAppUserAccessCheck(
    userId: number,
  ): Promise<AppUserAccessCheckResult> {
    const user = await this.db.query.appUser.findFirst({
      where: {
        id: userId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        isEnabled: true,
        status: true,
        banReason: true,
        banUntil: true,
      },
    })

    if (!user) {
      return {
        allowed: false,
        reason: 'not_found',
      }
    }

    if (!user.isEnabled) {
      return {
        allowed: false,
        reason: 'disabled',
        message: AppUserAccessMessages.ACCOUNT_DISABLED,
      }
    }

    if (this.isBannedStatus(user.status)) {
      return {
        allowed: false,
        reason: 'banned',
        code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
        message: this.buildBanAccessMessage(user),
      }
    }

    return {
      allowed: true,
      user,
    }
  }

  // 读取用户成长余额快照。
  // 当前统一返回积分与经验两类热余额，供用户域和权限域复用。
  async getUserGrowthSnapshot(userId: number): Promise<UserGrowthSnapshot> {
    const rows = await this.db
      .select({
        assetType: this.userAssetBalance.assetType,
        balance: this.userAssetBalance.balance,
      })
      .from(this.userAssetBalance)
      .where(
        and(
          eq(this.userAssetBalance.userId, userId),
          inArray(this.userAssetBalance.assetType, [
            GrowthAssetTypeEnum.POINTS,
            GrowthAssetTypeEnum.EXPERIENCE,
          ]),
          eq(this.userAssetBalance.assetKey, ''),
        ),
      )

    return {
      points:
        rows.find((item) => item.assetType === GrowthAssetTypeEnum.POINTS)
          ?.balance ?? 0,
      experience:
        rows.find((item) => item.assetType === GrowthAssetTypeEnum.EXPERIENCE)
          ?.balance ?? 0,
    }
  }

  // 批量查询当前仍可被提及的用户。
  // 仅返回 mention 场景需要的最小字段集。
  async findAvailableUsersByIds(
    userIds: number[],
  ): Promise<UserMentionCandidateDto[]> {
    const uniqueUserIds = [...new Set(userIds)]
    if (uniqueUserIds.length === 0) {
      return []
    }

    return this.db
      .select({
        id: this.appUser.id,
        nickname: this.appUser.nickname,
        avatarUrl: this.appUser.avatarUrl,
      })
      .from(this.appUser)
      .where(
        and(
          inArray(this.appUser.id, uniqueUserIds),
          eq(this.appUser.isEnabled, true),
          isNull(this.appUser.deletedAt),
        ),
      )
  }

  // 分页查询提及候选用户。
  // 空关键字直接返回空页，避免把接口误用成通用用户搜索。
  async queryMentionCandidates(
    query: QueryUserMentionPageDto,
  ): Promise<UserMentionCandidatePageResult> {
    const keyword = query.q?.trim()
    const page = this.drizzle.buildPage(
      {
        pageIndex: query.pageIndex,
        pageSize: query.pageSize,
      },
      {
        defaultPageSize: 10,
        maxPageSize: 20,
      },
    )

    if (!keyword) {
      return {
        list: [],
        total: 0,
        pageIndex: page.pageIndex,
        pageSize: page.pageSize,
        totalPages: 0,
      }
    }

    const condition = and(
      eq(this.appUser.isEnabled, true),
      isNull(this.appUser.deletedAt),
      buildILikeCondition(this.appUser.nickname, keyword),
    )

    const pageResult = await this.drizzle.ext.findPagination(this.appUser, {
      where: condition,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
      orderBy: query.orderBy?.trim() ? query.orderBy : { id: 'desc' as const },
      pick: ['id', 'nickname', 'avatarUrl'] as const,
    })

    return {
      ...pageResult,
      totalPages:
        pageResult.total === 0
          ? 0
          : Math.ceil(pageResult.total / pageResult.pageSize),
    }
  }

  // 判断状态码是否属于禁言态。
  // 禁言态会限制发帖和回复，但不阻断登录。
  isMutedStatus(status: number) {
    return (
      status === UserStatusEnum.MUTED ||
      status === UserStatusEnum.PERMANENT_MUTED
    )
  }

  // 判断状态码是否属于封禁态。
  // 封禁态会直接阻断登录，并驱动统一的封禁提示文案。
  isBannedStatus(status: number) {
    return (
      status === UserStatusEnum.BANNED ||
      status === UserStatusEnum.PERMANENT_BANNED
    )
  }

  // 将限制结束时间格式化为 app 时区文案。
  // 统一由核心服务处理，避免不同入口拼出不一致的时间字符串。
  private formatRestrictionUntil(date: Date) {
    return formatDateTimeInAppTimeZone(date)
  }

  // 生成封禁态访问提示文案。
  // 该文案会复用到登录、鉴权守卫和密码校验等入口，要求原因与解封时间口径一致。
  buildBanAccessMessage(user: UserBanAccessSource) {
    const parts = ['账号已被封禁']

    if (user.banReason?.trim()) {
      parts.push(`原因：${user.banReason.trim()}`)
    }

    parts.push(
      user.banUntil
        ? `解封时间：${this.formatRestrictionUntil(user.banUntil)}`
        : '解封时间：永久封禁',
    )

    return parts.join('，')
  }

  // 校验当前用户是否处于封禁态。
  // 若命中封禁，统一抛出稳定 403 文案，避免上层入口各自实现封禁分支。
  ensureAppUserNotBanned(user: UserBanGuardSource): void {
    if (this.isBannedStatus(user.status)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        this.buildBanAccessMessage(user),
      )
    }
  }

  // 将数据库用户实体映射为安全的对外用户对象。
  // 运行时明确排除 deletedAt 等内部审计字段，避免响应泄露只靠 Swagger 隐藏兜底。
  mapBaseUser(
    user: AppUserSelect,
    growth?: UserGrowthSnapshot,
  ): AppUserResponseDto {
    return {
      id: user.id,
      account: user.account,
      phoneNumber: user.phoneNumber ?? undefined,
      emailAddress: user.emailAddress ?? undefined,
      levelId: user.levelId ?? undefined,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl ?? undefined,
      profileBackgroundImageUrl: user.profileBackgroundImageUrl ?? undefined,
      signature: user.signature ?? undefined,
      bio: user.bio ?? undefined,
      isEnabled: user.isEnabled,
      genderType: user.genderType,
      birthDate: user.birthDate ?? undefined,
      points: growth?.points ?? 0,
      experience: growth?.experience ?? 0,
      status: user.status,
      banReason: user.banReason ?? undefined,
      banUntil: user.banUntil ?? undefined,
      lastLoginAt: user.lastLoginAt ?? undefined,
      lastLoginIp: user.lastLoginIp ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }

  // 构建用户状态摘要。
  // 统一收敛登录、发帖、回复、点赞、收藏和关注能力的判定口径。
  buildUserStatus(user: UserStatusSource): UserStatusSummaryDto {
    const isMuted = this.isMutedStatus(user.status)
    const isBanned = this.isBannedStatus(user.status)
    const canLogin = user.isEnabled && !isBanned
    const canPost = user.isEnabled && !isMuted && !isBanned
    const canReply = canPost
    const canLike = user.isEnabled && !isBanned
    const canFavorite = user.isEnabled && !isBanned
    const canFollow = user.isEnabled && !isBanned
    const reason = !user.isEnabled
      ? user.banReason || '账号已被禁用'
      : user.banReason || undefined

    return {
      isEnabled: user.isEnabled,
      status: user.status,
      canLogin,
      canPost,
      canReply,
      canLike,
      canFavorite,
      canFollow,
      reason,
      until: user.banUntil ?? undefined,
    }
  }

  // 获取用户计数。
  async getUserCounts(userId: number): Promise<AppUserCountSnapshot> {
    return this.appUserCountService.getUserCounts(userId)
  }

  // 获取用户徽章总数。
  async getBadgeCount(userId: number): Promise<number> {
    const [rows] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.userBadgeAssignment)
      .where(eq(this.userBadgeAssignment.userId, userId))
    return Number(rows?.count ?? 0)
  }

  // 获取等级信息。
  async getLevelInfo(
    levelId: number,
  ): Promise<UserLevelSummaryDto | undefined> {
    const [level] = await this.db
      .select({
        id: this.userLevelRule.id,
        name: this.userLevelRule.name,
        icon: this.userLevelRule.icon,
        color: this.userLevelRule.color,
        requiredExperience: this.userLevelRule.requiredExperience,
      })
      .from(this.userLevelRule)
      .where(eq(this.userLevelRule.id, levelId))
      .limit(1)

    return level
      ? {
          id: level.id,
          name: level.name,
          icon: level.icon ?? undefined,
          color: level.color ?? undefined,
          requiredExperience: level.requiredExperience,
        }
      : undefined
  }
}
