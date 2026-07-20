import type { SQL } from 'drizzle-orm'
import type { AppUserCountSnapshot } from './app-user-count.type'
import type {
  AppUserAccessCheckResult,
  AppUserResponseSource,
  UserBanAccessSource,
  UserBanGuardSource,
  UserCenterSource,
  UserStatusSource,
} from './user.type'
import {
  buildILikeCondition,
  DrizzleService,
  PostgresErrorCode,
  toPageResult,
} from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  formatDateOnlyInAppTimeZone,
  formatDateTimeInAppTimeZone,
} from '@libs/platform/utils'
import {
  AppUserAccessMessages,
  UserStatusEnum,
} from '@libs/user/app-user.constant'
import { HttpStatus, Injectable } from '@nestjs/common'
import { and, eq, gte, inArray, isNull, lt } from 'drizzle-orm'
import { AppUserCountService } from './app-user-count.service'
import { BaseAppUserDto } from './dto/base-app-user.dto'
import {
  QueryUserMentionPageDto,
  UpdateMyProfileDto,
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

  private get appUserResponseColumns() {
    return {
      id: true,
      account: true,
      phoneNumber: true,
      emailAddress: true,
      levelId: true,
      nickname: true,
      avatarUrl: true,
      profileBackgroundImageUrl: true,
      signature: true,
      bio: true,
      isEnabled: true,
      genderType: true,
      birthDate: true,
      status: true,
      banReason: true,
      banUntil: true,
      lastLoginAt: true,
      lastLoginIp: true,
      createdAt: true,
      updatedAt: true,
    } as const
  }

  private get userCenterColumns() {
    return {
      id: true,
      account: true,
      phoneNumber: true,
      nickname: true,
      avatarUrl: true,
      profileBackgroundImageUrl: true,
      emailAddress: true,
      genderType: true,
      birthDate: true,
      levelId: true,
      signature: true,
      bio: true,
      status: true,
      banReason: true,
      banUntil: true,
      lastLoginGeoCountry: true,
      lastLoginGeoProvince: true,
      lastLoginGeoCity: true,
      lastLoginGeoIsp: true,
    } as const
  }

  private get userStatusColumns() {
    return {
      isEnabled: true,
      status: true,
      banReason: true,
      banUntil: true,
    } as const
  }

  private get userPhoneColumns() {
    return {
      id: true,
      phoneNumber: true,
    } as const
  }

  // 校验用户存在且未软删除；存在性校验不得承担读取用户资料的职责。
  async assertActiveUserExists(userId: number): Promise<void> {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId, deletedAt: { isNull: true } },
      columns: { id: true },
    })
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '应用用户不存在',
      )
    }
  }

  // 获取公共资料响应所需的完整稳定字段集。
  async getAppUserResponseSource(
    userId: number,
  ): Promise<AppUserResponseSource> {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId, deletedAt: { isNull: true } },
      columns: this.appUserResponseColumns,
    })
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '应用用户不存在',
      )
    }
    return user
  }

  // 获取当前用户中心专用资料，地理快照仅限本人中心使用。
  async getUserCenterSource(userId: number): Promise<UserCenterSource> {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId, deletedAt: { isNull: true } },
      columns: this.userCenterColumns,
    })
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '应用用户不存在',
      )
    }
    return user
  }

  // 换绑手机号仅需要当前手机号，不复用公共资料读模型。
  async getUserPhoneSource(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId, deletedAt: { isNull: true } },
      columns: this.userPhoneColumns,
    })
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '应用用户不存在',
      )
    }
    return user
  }

  // 状态与会话校验共用同一最小字段集；nullable 版本保留刷新令牌既有错误语义。
  async getUserStatusSource(userId: number): Promise<UserStatusSource> {
    const user = await this.findUserStatusSource(userId)
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '应用用户不存在',
      )
    }
    return user
  }

  async findUserStatusSource(
    userId: number,
  ): Promise<UserStatusSource | undefined> {
    return this.db.query.appUser.findFirst({
      where: { id: userId, deletedAt: { isNull: true } },
      columns: this.userStatusColumns,
    })
  }

  // 判断手机号是否仍绑定在未删除的应用用户上，供短信入口使用防枚举分支。
  async hasActiveUserWithPhone(phone: string): Promise<boolean> {
    const user = await this.db.query.appUser.findFirst({
      where: { phoneNumber: phone, deletedAt: { isNull: true } },
      columns: { id: true },
    })
    return Boolean(user)
  }

  // 更新用户资料，邮箱唯一冲突使用稳定业务文案。
  async updateUserProfile(userId: number, dto: UpdateMyProfileDto) {
    await this.assertActiveUserExists(userId)

    try {
      await this.drizzle.withErrorHandling(
        () =>
          this.db
            .update(this.appUser)
            .set({
              nickname: dto.nickname,
              avatarUrl: dto.avatarUrl,
              profileBackgroundImageUrl: dto.profileBackgroundImageUrl,
              emailAddress: dto.emailAddress,
              genderType: dto.genderType,
              signature: dto.signature,
              bio: dto.bio,
              birthDate:
                dto.birthDate === undefined
                  ? undefined
                  : dto.birthDate === null
                    ? null
                    : formatDateOnlyInAppTimeZone(dto.birthDate),
            })
            .where(eq(this.appUser.id, userId)),
        { notFound: '用户不存在' },
      )
      return true
    } catch (error) {
      const facts = this.drizzle.classifyError(error)
      if (
        facts?.sqlState === PostgresErrorCode.UNIQUE_VIOLATION &&
        facts.constraint === 'app_user_email_address_key'
      ) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '邮箱已被使用',
          { cause: error },
        )
      }
      throw error
    }
  }

  // 写入换绑后的手机号，新号已存在时返回稳定业务错误。
  async changeUserPhoneNumber(userId: number, phoneNumber: string) {
    try {
      await this.drizzle.withErrorHandling(
        () =>
          this.db
            .update(this.appUser)
            .set({ phoneNumber })
            .where(eq(this.appUser.id, userId)),
        { notFound: '用户不存在' },
      )
      return true
    } catch (error) {
      const facts = this.drizzle.classifyError(error)
      if (
        facts?.sqlState === PostgresErrorCode.UNIQUE_VIOLATION &&
        facts.constraint === 'app_user_phone_number_key'
      ) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '手机号已注册',
          { cause: error },
        )
      }
      throw error
    }
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

    if (this.isBannedStatus(user.status, user.banUntil)) {
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
  async queryMentionCandidates(query: QueryUserMentionPageDto) {
    const pageParams = this.drizzle.buildPageParams(query, {
      defaultPageSize: 10,
      maxPageSize: 20,
      allowlistedOrderBy: {
        columns: {
          nickname: this.appUser.nickname,
          account: this.appUser.account,
          id: this.appUser.id,
        },
        fallbackOrderBy: [
          { nickname: 'asc' },
          { account: 'asc' },
          { id: 'asc' },
        ],
      },
    })
    const keyword = query.q?.trim()

    if (!keyword) {
      return toPageResult([], 0, pageParams.page)
    }

    const conditions: SQL[] = [
      eq(this.appUser.isEnabled, true),
      isNull(this.appUser.deletedAt),
    ]
    const keywordCondition = buildILikeCondition(this.appUser.nickname, keyword)
    if (keywordCondition) {
      conditions.push(keywordCondition)
    }
    if (pageParams.dateRange?.gte) {
      conditions.push(gte(this.appUser.createdAt, pageParams.dateRange.gte))
    }
    if (pageParams.dateRange?.lt) {
      conditions.push(lt(this.appUser.createdAt, pageParams.dateRange.lt))
    }
    const where = and(...conditions)

    const [rows, total] = await Promise.all([
      this.db
        .select({
          id: this.appUser.id,
          nickname: this.appUser.nickname,
          avatarUrl: this.appUser.avatarUrl,
        })
        .from(this.appUser)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(this.appUser, where),
    ])

    return toPageResult(rows, total, pageParams.page)
  }

  // 判断状态码是否属于禁言态。
  // 禁言态会限制发帖和回复，但不阻断登录。
  isMutedStatus(status: number, banUntil?: Date | null) {
    if (!this.isRestrictionActive(status, banUntil)) {
      return false
    }

    return (
      status === UserStatusEnum.MUTED ||
      status === UserStatusEnum.PERMANENT_MUTED
    )
  }

  // 判断状态码是否属于封禁态。
  // 封禁态会直接阻断登录，并驱动统一的封禁提示文案。
  isBannedStatus(status: number, banUntil?: Date | null) {
    if (!this.isRestrictionActive(status, banUntil)) {
      return false
    }

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

  private isRestrictionActive(status: number, banUntil?: Date | null) {
    if (
      status === UserStatusEnum.PERMANENT_MUTED ||
      status === UserStatusEnum.PERMANENT_BANNED
    ) {
      return true
    }
    if (status === UserStatusEnum.MUTED || status === UserStatusEnum.BANNED) {
      return Boolean(banUntil && banUntil > new Date())
    }

    return true
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
    if (this.isBannedStatus(user.status, user.banUntil)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        this.buildBanAccessMessage(user),
        { httpStatus: HttpStatus.FORBIDDEN },
      )
    }
  }

  // 将数据库用户实体映射为安全的对外用户对象。
  // 通过最小输入字段集避免查询侧为映射读取 password、登录地理信息或 deletedAt。
  mapBaseUser<TDetails extends object = Record<never, never>>(
    user: AppUserResponseSource,
    details?: TDetails,
  ): BaseAppUserDto & TDetails {
    return {
      id: user.id,
      account: user.account,
      phoneNumber: user.phoneNumber ?? null,
      emailAddress: user.emailAddress ?? null,
      levelId: user.levelId ?? null,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl ?? null,
      profileBackgroundImageUrl: user.profileBackgroundImageUrl ?? null,
      signature: user.signature ?? null,
      bio: user.bio ?? null,
      isEnabled: user.isEnabled,
      genderType: user.genderType,
      birthDate: user.birthDate ?? null,
      status: user.status,
      banReason: user.banReason ?? null,
      banUntil: user.banUntil ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      lastLoginIp: user.lastLoginIp ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      ...details,
    } as BaseAppUserDto & TDetails
  }

  // 构建用户状态摘要。
  // 统一收敛登录、发帖、回复、点赞、收藏和关注能力的判定口径。
  buildUserStatus(user: UserStatusSource): UserStatusSummaryDto {
    const isMuted = this.isMutedStatus(user.status, user.banUntil)
    const isBanned = this.isBannedStatus(user.status, user.banUntil)
    const canLogin = user.isEnabled && !isBanned
    const canPost = user.isEnabled && !isMuted && !isBanned
    const canReply = canPost
    const canLike = user.isEnabled && !isBanned
    const canFavorite = user.isEnabled && !isBanned
    const canFollow = user.isEnabled && !isBanned
    const reason = !user.isEnabled
      ? user.banReason || '账号已被禁用'
      : (user.banReason ?? null)

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
      until: user.banUntil ?? null,
    }
  }

  // 获取用户计数。
  async getUserCounts(userId: number): Promise<AppUserCountSnapshot> {
    return this.appUserCountService.getUserCounts(userId)
  }
}
