import { DrizzleService } from '@db/core'
import { AppUserSelect } from '@db/schema'
import { UserStatusEnum } from '@libs/platform/constant'
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { AppUserCountService } from './app-user-count.service'

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

  isMutedStatus(status: number): boolean {
    return (
      status === UserStatusEnum.MUTED
      || status === UserStatusEnum.PERMANENT_MUTED
    )
  }

  isBannedStatus(status: number): boolean {
    return (
      status === UserStatusEnum.BANNED
      || status === UserStatusEnum.PERMANENT_BANNED
    )
  }

  private formatRestrictionUntil(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

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
   * 将数据库用户实体映射为安全的对外用户对象
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
      deletedAt: user.deletedAt ?? undefined,
    }
  }

  /**
   * 构建用户状态信息
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
