import type {
  ForumAccessUserContext,
  ForumPostingUserContext,
  ForumSectionPermissionContext,
} from './forum-permission.type'
import { DrizzleService } from '@db/core'
import { UserStatusEnum } from '@libs/platform/constant'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, desc, eq, gte } from 'drizzle-orm'

/**
 * 论坛权限服务。
 * 统一处理板块等级访问、发帖频控与等级限制。
 */
@Injectable()
export class ForumPermissionService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get appUser() {
    return this.drizzle.schema.appUser
  }

  private get forumSection() {
    return this.drizzle.schema.forumSection
  }

  private get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  private get userComment() {
    return this.drizzle.schema.userComment
  }

  /**
   * 获取发帖所需的用户上下文，包含等级配置中的频控参数。
   */
  private async getPostingUserContext(
    userId: number,
  ): Promise<ForumPostingUserContext> {
    const user = await this.db.query.appUser.findFirst({
      where: {
        id: userId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        isEnabled: true,
        status: true,
        experience: true,
      },
      with: {
        level: {
          columns: {
            dailyTopicLimit: true,
            postInterval: true,
          },
        },
      },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    return user
  }

  /**
   * 获取访问权限校验所需的用户上下文。
   * 用户不存在时返回 null，由调用方决定如何处理。
   */
  private async getAccessUserContext(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: {
        id: userId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        isEnabled: true,
        experience: true,
      },
    })

    return user ?? null
  }

  /**
   * 获取板块权限上下文，包含等级规则与所需经验值。
   * @param requireEnabled 为 true 时，板块未启用会抛出异常
   */
  private async getSectionPermissionContext(
    sectionId: number,
    options?: {
      requireEnabled?: boolean
      notFoundMessage?: string
    },
  ): Promise<ForumSectionPermissionContext> {
    const section = await this.db.query.forumSection.findFirst({
      where: {
        id: sectionId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        name: true,
        isEnabled: true,
        topicReviewPolicy: true,
        userLevelRuleId: true,
      },
      with: {
        userLevelRule: {
          columns: {
            requiredExperience: true,
          },
        },
      },
    })

    if (!section) {
      throw new BadRequestException(
        options?.notFoundMessage ?? '板块不存在或已禁用',
      )
    }

    if (options?.requireEnabled && !section.isEnabled) {
      throw new BadRequestException('板块不存在或已禁用')
    }

    return {
      ...section,
      requiredExperience: section.userLevelRule?.requiredExperience ?? null,
    }
  }

  /**
   * 校验用户是否可发帖。
   * 禁用用户、禁言/封禁状态用户不允许发帖。
   */
  private ensurePostingUserAvailable(user: ForumPostingUserContext) {
    if (!user.isEnabled) {
      throw new BadRequestException('用户不存在或已被禁用')
    }

    if (
      [
        UserStatusEnum.MUTED,
        UserStatusEnum.PERMANENT_MUTED,
        UserStatusEnum.BANNED,
        UserStatusEnum.PERMANENT_BANNED,
      ].includes(user.status)
    ) {
      throw new BadRequestException('用户已被禁言或封禁，无法发布主题')
    }
  }

  /**
   * 校验用户等级是否满足板块访问要求。
   * - 无等级限制的板块直接放行
   * - 有等级限制时，未登录用户需先登录，已登录用户需经验值达标
   */
  ensureSectionLevelAccess(
    section: ForumSectionPermissionContext,
    user?:
      | ForumAccessUserContext
      | Pick<ForumPostingUserContext, 'experience'>
      | null,
  ) {
    if (!section.userLevelRuleId || section.requiredExperience === null) {
      return
    }

    if (!user) {
      throw new BadRequestException('请先登录后访问该板块')
    }

    if ('isEnabled' in user && !user.isEnabled) {
      throw new BadRequestException('用户不存在或已被禁用')
    }

    if (user.experience < section.requiredExperience) {
      throw new BadRequestException('当前板块需要更高等级')
    }
  }

  /**
   * 校验发帖频率限制。
   * - 每日发帖上限：统计当天已发主题数
   * - 发帖间隔：取最近一次发帖/评论时间计算冷却时间
   */
  private async ensureTopicRateLimit(
    userId: number,
    level: ForumPostingUserContext['level'],
  ) {
    if (!level) {
      return
    }

    if (level.dailyTopicLimit > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const usedToday = await this.db.$count(
        this.forumTopic,
        and(
          eq(this.forumTopic.userId, userId),
          gte(this.forumTopic.createdAt, today),
        ),
      )

      if (usedToday >= level.dailyTopicLimit) {
        throw new BadRequestException(
          `今日发帖次数已达上限（${level.dailyTopicLimit}）`,
        )
      }
    }

    if (level.postInterval > 0) {
      const [lastTopic, lastComment] = await Promise.all([
        this.db
          .select({ createdAt: this.forumTopic.createdAt })
          .from(this.forumTopic)
          .where(eq(this.forumTopic.userId, userId))
          .orderBy(desc(this.forumTopic.createdAt))
          .limit(1),
        this.db
          .select({ createdAt: this.userComment.createdAt })
          .from(this.userComment)
          .where(eq(this.userComment.userId, userId))
          .orderBy(desc(this.userComment.createdAt))
          .limit(1),
      ])

      const latestTopic = lastTopic[0]
      const latestComment = lastComment[0]
      const lastPostAt =
        latestTopic && latestComment
          ? latestTopic.createdAt > latestComment.createdAt
            ? latestTopic.createdAt
            : latestComment.createdAt
          : (latestTopic?.createdAt ?? latestComment?.createdAt ?? null)

      if (!lastPostAt) {
        return
      }

      const secondsSinceLastPost = Math.floor(
        (Date.now() - lastPostAt.getTime()) / 1000,
      )

      if (secondsSinceLastPost < level.postInterval) {
        throw new BadRequestException(
          `操作过于频繁，请 ${level.postInterval - secondsSinceLastPost} 秒后再试`,
        )
      }
    }
  }

  /**
   * 校验用户是否可在指定板块发帖。
   * 依次检查：用户状态 → 板块等级限制 → 发帖频率限制。
   * @returns 板块权限上下文，供上层读取审核策略等字段
   */
  async ensureUserCanCreateTopic(userId: number, sectionId: number) {
    const [user, section] = await Promise.all([
      this.getPostingUserContext(userId),
      this.getSectionPermissionContext(sectionId, { requireEnabled: true }),
    ])

    this.ensurePostingUserAvailable(user)
    this.ensureSectionLevelAccess(section, user)
    await this.ensureTopicRateLimit(userId, user.level)

    return section
  }

  /**
   * 校验当前用户是否可访问指定板块。
   * 仅检查板块等级限制，不涉及发帖频控。
   */
  async ensureUserCanAccessSection(
    sectionId: number,
    userId?: number,
    options?: {
      requireEnabled?: boolean
      notFoundMessage?: string
    },
  ) {
    const [section, user] = await Promise.all([
      this.getSectionPermissionContext(sectionId, options),
      userId ? this.getAccessUserContext(userId) : Promise.resolve(null),
    ])

    this.ensureSectionLevelAccess(section, user)
    return section
  }

  /**
   * 获取当前用户可访问的板块 ID 列表。
   * 未登录用户只能访问没有等级限制的板块。
   */
  async getAccessibleSectionIds(userId?: number) {
    const [sections, user] = await Promise.all([
      this.db.query.forumSection.findMany({
        where: {
          deletedAt: { isNull: true },
          isEnabled: true,
        },
        columns: {
          id: true,
          userLevelRuleId: true,
        },
        with: {
          userLevelRule: {
            columns: {
              requiredExperience: true,
            },
          },
        },
      }),
      userId ? this.getAccessUserContext(userId) : Promise.resolve(null),
    ])

    return sections
      .filter((section) => {
        const requiredExperience =
          section.userLevelRule?.requiredExperience ?? null
        if (!section.userLevelRuleId || requiredExperience === null) {
          return true
        }

        if (!user || !user.isEnabled) {
          return false
        }

        return user.experience >= requiredExperience
      })
      .map((section) => section.id)
  }
}
