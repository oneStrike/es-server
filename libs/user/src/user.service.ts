import { DrizzleService } from '@db/core'
import { AppUser } from '@db/schema'
import { UserStatusEnum } from '@libs/platform/constant'
import { Injectable, NotFoundException } from '@nestjs/common'
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
  async ensureUserExists(userId: number): Promise<AppUser> {
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
  async findById(userId: number): Promise<AppUser | undefined> {
    const [user] = await this.db
      .select()
      .from(this.appUser)
      .where(and(eq(this.appUser.id, userId), isNull(this.appUser.deletedAt)))
      .limit(1)
    return user
  }

  /**
   * 将数据库用户实体映射为安全的对外用户对象
   */
  mapBaseUser(user: AppUser) {
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
    // 被禁止互动的状态集合
    const interactionBlockedStatuses = new Set<number>([
      UserStatusEnum.MUTED,
      UserStatusEnum.PERMANENT_MUTED,
      UserStatusEnum.BANNED,
      UserStatusEnum.PERMANENT_BANNED,
    ])

    const canLogin = user.isEnabled
    const canInteract =
      user.isEnabled && !interactionBlockedStatuses.has(user.status)
    const reason = !user.isEnabled
      ? user.banReason || '账号已被禁用'
      : user.banReason || undefined

    return {
      isEnabled: user.isEnabled,
      status: user.status,
      canLogin,
      canPost: canInteract,
      canReply: canInteract,
      canLike: canInteract,
      canFavorite: canInteract,
      canFollow: canInteract,
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
