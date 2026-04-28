import type {
  ForumAccessUserContext,
  ForumPostingUserContext,
  ForumSectionAccessState,
  ForumSectionPermissionContext,
} from './forum-permission.type'
import { DrizzleService } from '@db/core'
import { GrowthAssetTypeEnum } from '@libs/growth/growth-ledger/growth-ledger.constant'
import { AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { startOfTodayInAppTimeZone } from '@libs/platform/utils'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
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

  private get userAssetBalance() {
    return this.drizzle.schema.userAssetBalance
  }

  /**
   * 获取发帖所需的用户上下文，包含等级配置中的频控参数。
   */
  private async getPostingUserContext(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: {
        id: userId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        isEnabled: true,
        status: true,
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }

    const experience = await this.getUserExperience(userId)
    return {
      ...user,
      experience,
    }
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
      },
    })

    if (!user) {
      return null
    }

    return {
      ...user,
      experience: await this.getUserExperience(userId),
    }
  }

  private async getUserExperience(userId: number) {
    const balance = await this.db.query.userAssetBalance.findFirst({
      where: {
        userId,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        assetKey: '',
      },
      columns: {
        balance: true,
      },
    })

    return balance?.balance ?? 0
  }

  /**
   * 判断板块在公开访问语义下是否可用。
   * 板块本身必须启用；若挂载分组，则分组也必须启用且未删除。
   */
  isSectionPubliclyAvailable(
    section: Pick<
      ForumSectionPermissionContext,
      'groupId' | 'deletedAt' | 'isEnabled'
    > & {
      group?: {
        isEnabled: boolean
        deletedAt: Date | null
      } | null
    },
  ) {
    if (section.deletedAt) {
      return false
    }

    if (!section.isEnabled) {
      return false
    }

    if (!section.groupId) {
      return true
    }

    return Boolean(
      section.group && section.group.isEnabled && !section.group.deletedAt,
    )
  }

  /**
   * 将板块查询结果归一化为访问状态计算所需字段。
   * 统一在这里补齐 requiredExperience 与公开可见性，避免各入口各自复制同一套映射。
   */
  private buildSectionAccessContext(
    section: Pick<
      ForumSectionPermissionContext,
      'groupId' | 'deletedAt' | 'isEnabled' | 'userLevelRuleId'
    > & {
      group?: {
        isEnabled: boolean
        deletedAt: Date | null
      } | null
      userLevelRule?: {
        requiredExperience: number
      } | null
    },
  ) {
    return {
      groupId: section.groupId,
      deletedAt: section.deletedAt,
      isEnabled: section.isEnabled,
      isPubliclyAvailable: this.isSectionPubliclyAvailable(section),
      userLevelRuleId: section.userLevelRuleId,
      requiredExperience: section.userLevelRule?.requiredExperience ?? null,
    }
  }

  /**
   * 获取板块权限上下文，包含等级规则与所需经验值。
   */
  private async getSectionPermissionContext(
    sectionId: number,
    options?: {
      requireEnabled?: boolean
      notFoundMessage?: string
    },
  ) {
    const section = await this.db.query.forumSection.findFirst({
      where: {
        id: sectionId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        groupId: true,
        deletedAt: true,
        name: true,
        isEnabled: true,
        topicReviewPolicy: true,
        userLevelRuleId: true,
      },
      with: {
        group: {
          columns: {
            isEnabled: true,
            deletedAt: true,
          },
        },
        userLevelRule: {
          columns: {
            requiredExperience: true,
          },
        },
      },
    })

    if (!section) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        options?.notFoundMessage ?? '板块不存在或已禁用',
      )
    }

    const accessContext = this.buildSectionAccessContext(section)

    if (options?.requireEnabled && !accessContext.isPubliclyAvailable) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '板块不存在或已禁用',
      )
    }

    return {
      ...section,
      requiredExperience: accessContext.requiredExperience,
      isPubliclyAvailable: accessContext.isPubliclyAvailable,
    }
  }

  /**
   * 校验用户是否可发帖。
   * 禁用用户、禁言/封禁状态用户不允许发帖。
   */
  private ensurePostingUserAvailable(user: ForumPostingUserContext) {
    if (!user.isEnabled) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在或已被禁用',
      )
    }

    if (
      [
        UserStatusEnum.MUTED,
        UserStatusEnum.PERMANENT_MUTED,
        UserStatusEnum.BANNED,
        UserStatusEnum.PERMANENT_BANNED,
      ].includes(user.status)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '用户已被禁言或封禁，无法发布主题',
      )
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
    const accessState = this.resolveSectionAccessState(section, user)
    if (!accessState.canAccess) {
      this.throwSectionAccessDenied(accessState)
    }
  }

  private throwSectionAccessDenied(
    accessState: ForumSectionAccessState,
  ): never {
    const reason = accessState.accessDeniedReason ?? '当前操作不允许执行'
    const accessDeniedCode = accessState.accessDeniedCode ?? 'USER_DISABLED'

    switch (accessDeniedCode) {
      case 'LOGIN_REQUIRED':
        throw new UnauthorizedException(reason)
      case 'LEVEL_REQUIRED':
        throw new BusinessException(BusinessErrorCode.QUOTA_NOT_ENOUGH, reason)
      case 'SECTION_UNAVAILABLE':
        throw new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, reason)
      case 'USER_DISABLED':
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          reason,
        )
    }
  }

  /**
   * 计算用户对板块的访问状态。
   * 用于“板块可见但访问受限”场景向前端返回可读提示。
   */
  private resolveSectionAccessState(
    section: Pick<
      ForumSectionPermissionContext,
      | 'groupId'
      | 'isEnabled'
      | 'isPubliclyAvailable'
      | 'userLevelRuleId'
      | 'requiredExperience'
    >,
    user?:
      | ForumAccessUserContext
      | Pick<ForumPostingUserContext, 'experience'>
      | null,
  ): ForumSectionAccessState {
    const requiredExperience =
      section.userLevelRuleId && section.requiredExperience !== null
        ? section.requiredExperience
        : null

    if (!section.isPubliclyAvailable) {
      return {
        canAccess: false,
        requiredExperience,
        accessDeniedCode: 'SECTION_UNAVAILABLE',
        accessDeniedReason: '板块不存在或已禁用',
      }
    }

    if (requiredExperience === null) {
      return {
        canAccess: true,
        requiredExperience: null,
      }
    }

    if (!user) {
      return {
        canAccess: false,
        requiredExperience,
        accessDeniedCode: 'LOGIN_REQUIRED',
        accessDeniedReason: '请先登录后访问该板块',
      }
    }

    if ('isEnabled' in user && !user.isEnabled) {
      return {
        canAccess: false,
        requiredExperience,
        accessDeniedCode: 'USER_DISABLED',
        accessDeniedReason: '用户不存在或已被禁用',
      }
    }

    if (user.experience < requiredExperience) {
      return {
        canAccess: false,
        requiredExperience,
        accessDeniedCode: 'LEVEL_REQUIRED',
        accessDeniedReason: '当前板块需要更高等级访问',
      }
    }

    return {
      canAccess: true,
      requiredExperience,
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
      const today = startOfTodayInAppTimeZone()

      const usedToday = await this.db.$count(
        this.forumTopic,
        and(
          eq(this.forumTopic.userId, userId),
          gte(this.forumTopic.createdAt, today),
        ),
      )

      if (usedToday >= level.dailyTopicLimit) {
        throw new BusinessException(
          BusinessErrorCode.QUOTA_NOT_ENOUGH,
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
        throw new HttpException(
          `操作过于频繁，请 ${level.postInterval - secondsSinceLastPost} 秒后再试`,
          HttpStatus.TOO_MANY_REQUESTS,
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
   * 校验当前用户是否可访问指定主题所属板块。
   * 供评论等目标链路复用 forum 侧统一的板块公开访问事实源。
   */
  async ensureUserCanAccessTopicSection(topicId: number, userId: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id: topicId,
        deletedAt: { isNull: true },
      },
      columns: {
        sectionId: true,
        auditStatus: true,
        isHidden: true,
      },
    })

    if (
      !topic ||
      topic.auditStatus !== AuditStatusEnum.APPROVED ||
      topic.isHidden
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '帖子不存在',
      )
    }

    return this.ensureUserCanAccessSection(topic.sectionId, userId, {
      requireEnabled: true,
      notFoundMessage: '帖子不存在',
    })
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
          groupId: true,
          deletedAt: true,
          isEnabled: true,
          userLevelRuleId: true,
        },
        with: {
          group: {
            columns: {
              isEnabled: true,
              deletedAt: true,
            },
          },
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
        const accessState = this.resolveSectionAccessState(
          this.buildSectionAccessContext(section),
          user,
        )
        return accessState.canAccess
      })
      .map((section) => section.id)
  }

  /**
   * 批量计算板块访问状态。
   * 用于列表接口返回板块可见性与访问限制提示。
   */
  async getSectionAccessStateMap(sectionIds: number[], userId?: number) {
    const uniqueSectionIds = [...new Set(sectionIds)]
    if (uniqueSectionIds.length === 0) {
      return new Map<number, ForumSectionAccessState>()
    }

    const [sections, user] = await Promise.all([
      this.db.query.forumSection.findMany({
        where: {
          id: {
            in: uniqueSectionIds,
          },
          deletedAt: { isNull: true },
        },
        columns: {
          id: true,
          groupId: true,
          deletedAt: true,
          isEnabled: true,
          userLevelRuleId: true,
        },
        with: {
          group: {
            columns: {
              isEnabled: true,
              deletedAt: true,
            },
          },
          userLevelRule: {
            columns: {
              requiredExperience: true,
            },
          },
        },
      }),
      userId ? this.getAccessUserContext(userId) : Promise.resolve(null),
    ])

    const accessMap = new Map<number, ForumSectionAccessState>()
    for (const section of sections) {
      accessMap.set(
        section.id,
        this.resolveSectionAccessState(
          this.buildSectionAccessContext(section),
          user,
        ),
      )
    }

    return accessMap
  }
}
