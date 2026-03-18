import { DrizzleService } from '@db/core'
import { AppUser } from '@db/schema'
import { UserStatusEnum } from '@libs/platform/constant'
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

@Injectable()
export class UserService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get appUser() {
    return this.drizzle.schema.appUser
  }

  private get forumProfile() {
    return this.drizzle.schema.forumProfile
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
      reason,
      until: user.banUntil ?? undefined,
    }
  }

  /**
   * 映射用户基础字段（脱敏或格式化）
   */
  mapBaseUser(user: AppUser) {
    return {
      id: user.id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      account: user.account,
      phone: user.phoneNumber ?? undefined,
      nickname: user.nickname,
      avatar: user.avatarUrl ?? undefined,
      email: user.emailAddress ?? undefined,
      isEnabled: user.isEnabled,
      gender: user.genderType,
      birthDate: user.birthDate ? new Date(user.birthDate) : undefined,
      points: user.points,
      experience: user.experience,
      levelId: user.levelId ?? undefined,
      status: user.status,
      banReason: user.banReason ?? undefined,
      banUntil: user.banUntil ?? undefined,
      lastLoginAt: user.lastLoginAt ?? undefined,
      lastLoginIp: user.lastLoginIp ?? undefined,
    }
  }

  /**
   * 获取用户论坛资料
   */
  async getUserForumProfile(userId: number) {
    const forumProfile = await this.db
      .select({
        signature: this.forumProfile.signature,
        bio: this.forumProfile.bio,
        topicCount: this.forumProfile.topicCount,
        replyCount: this.forumProfile.replyCount,
        likeCount: this.forumProfile.likeCount,
        favoriteCount: this.forumProfile.favoriteCount,
      })
      .from(this.forumProfile)
      .where(eq(this.forumProfile.userId, userId))
      .limit(1)
      .then((rows) => rows[0])

    return {
      signature: forumProfile?.signature ?? '',
      bio: forumProfile?.bio ?? '',
      topicCount: forumProfile?.topicCount ?? 0,
      replyCount: forumProfile?.replyCount ?? 0,
      likeCount: forumProfile?.likeCount ?? 0,
      favoriteCount: forumProfile?.favoriteCount ?? 0,
    }
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
