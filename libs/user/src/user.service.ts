import type { AppUserSelect } from '@db/schema'
import { DrizzleService } from '@db/core'
import { UserStatusEnum } from '@libs/platform/constant/user.constant';
import { formatDateTimeInAppTimeZone } from '@libs/platform/utils/time';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { AppUserCountService } from './app-user-count.service'

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

  private get db() {
    return this.drizzle.db
  }

  private get appUser() {
    return this.drizzle.schema.appUser
  }

  private get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  private get userBadgeAssignment() {
    return this.drizzle.schema.userBadgeAssignment
  }

  /**
   * 确保用户存在
   */
  async ensureUserExists(userId: number): Promise<AppUserSelect> {
    const [user] = await this.db
      .select()
      .from(this.appUser)
      .where(and(eq(this.appUser.id, userId), isNull(this.appUser.deletedAt)))
      .limit(1)
    if (!user) {
      throw new NotFoundException('应用用户不存在')
    }
    return user
  }

  /**
   * 获取用户基础信息
   */
  async findById(userId: number): Promise<AppUserSelect | undefined> {
    const [user] = await this.db
      .select()
      .from(this.appUser)
      .where(and(eq(this.appUser.id, userId), isNull(this.appUser.deletedAt)))
      .limit(1)
    return user
  }

  /**
   * 判断状态码是否属于禁言态。
   * 禁言态会限制发帖和回复，但不阻断登录。
   */
  isMutedStatus(status: number): boolean {
    return (
      status === UserStatusEnum.MUTED ||
      status === UserStatusEnum.PERMANENT_MUTED
    )
  }

  /**
   * 判断状态码是否属于封禁态。
   * 封禁态会直接阻断登录，并驱动统一的封禁提示文案。
   */
  isBannedStatus(status: number): boolean {
    return (
      status === UserStatusEnum.BANNED ||
      status === UserStatusEnum.PERMANENT_BANNED
    )
  }

  /**
   * 将限制结束时间格式化为 app 时区文案。
   * 统一由核心服务处理，避免不同入口拼出不一致的时间字符串。
   */
  private formatRestrictionUntil(date: Date) {
    return formatDateTimeInAppTimeZone(date)
  }

  /**
   * 生成封禁态访问提示文案。
   * 该文案会复用到登录、鉴权守卫和密码校验等入口，要求原因与解封时间口径一致。
   */
  buildBanAccessMessage(user: {
    banReason: string | null
    banUntil: Date | null
  }): string {
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

  /**
   * 校验当前用户是否处于封禁态。
   * 若命中封禁，直接抛出稳定业务异常，避免上层入口各自实现封禁分支。
   */
  ensureAppUserNotBanned(user: {
    status: number
    banReason: string | null
    banUntil: Date | null
  }): void {
    if (this.isBannedStatus(user.status)) {
      throw new ForbiddenException(this.buildBanAccessMessage(user))
    }
  }

  /**
   * 将数据库用户实体映射为安全的对外用户对象。
   * 运行时明确排除 deletedAt 等内部审计字段，避免响应泄露只靠 Swagger 隐藏兜底。
   */
  mapBaseUser(user: AppUserSelect) {
    return {
      id: user.id,
      account: user.account,
      phoneNumber: user.phoneNumber ?? undefined,
      emailAddress: user.emailAddress ?? undefined,
      levelId: user.levelId ?? undefined,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl ?? undefined,
      signature: user.signature ?? undefined,
      bio: user.bio ?? undefined,
      isEnabled: user.isEnabled,
      genderType: user.genderType,
      birthDate: user.birthDate ?? undefined,
      points: user.points,
      experience: user.experience,
      status: user.status,
      banReason: user.banReason ?? undefined,
      banUntil: user.banUntil ?? undefined,
      lastLoginAt: user.lastLoginAt ?? undefined,
      lastLoginIp: user.lastLoginIp ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }

  /**
   * 构建用户状态摘要。
   * 统一收敛登录、发帖、回复、点赞、收藏和关注能力的判定口径。
   */
  buildUserStatus(user: {
    isEnabled: boolean
    status: number
    banReason: string | null
    banUntil: Date | null
  }) {
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

  /**
   * 获取用户计数
   */
  async getUserCounts(userId: number) {
    return this.appUserCountService.getUserCounts(userId)
  }

  /**
   * 获取用户徽章总数
   */
  async getBadgeCount(userId: number): Promise<number> {
    const [rows] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.userBadgeAssignment)
      .where(eq(this.userBadgeAssignment.userId, userId))
    return Number(rows?.count ?? 0)
  }

  /**
   * 获取等级信息
   */
  async getLevelInfo(levelId: number) {
    const [level] = await this.db
      .select({
        id: this.userLevelRule.id,
        name: this.userLevelRule.name,
        requiredExperience: this.userLevelRule.requiredExperience,
      })
      .from(this.userLevelRule)
      .where(eq(this.userLevelRule.id, levelId))
      .limit(1)
    return level
  }
}
