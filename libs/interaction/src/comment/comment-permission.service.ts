import type { DbTransaction } from '@db/core'
import { DrizzleService } from '@db/core'
import { ForumPermissionService } from '@libs/forum/permission/forum-permission.service'
import { UserLevelRuleService } from '@libs/growth/level-rule/level-rule.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import { Injectable } from '@nestjs/common'
import { CommentTargetTypeEnum } from './comment.constant'

@Injectable()
export class CommentPermissionService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly forumPermissionService: ForumPermissionService,
    private readonly userLevelRuleService: UserLevelRuleService,
  ) {}

  private readonly forumBusiness = 'forum'

  private get db() {
    return this.drizzle.db
  }

  async ensureCanComment(
    userId: number,
    targetType: CommentTargetTypeEnum,
    targetId: number,
  ) {
    await this.ensureUserCanComment(userId, targetType, targetId)
  }

  async ensureUserCanComment(
    userId: number,
    targetType?: CommentTargetTypeEnum,
    targetId?: number,
  ) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
      columns: {
        id: true,
        isEnabled: true,
        status: true,
      },
    })

    if (!user || !user.isEnabled) {
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
        '用户已被禁言或封禁，无法评论',
      )
    }

    if (
      targetType === CommentTargetTypeEnum.FORUM_TOPIC &&
      typeof targetId === 'number'
    ) {
      await this.forumPermissionService.ensureUserCanAccessTopicSection(
        targetId,
        userId,
      )
    }
  }

  async ensureCommentRateLimitInTx(
    tx: DbTransaction,
    userId: number,
    targetType: CommentTargetTypeEnum,
  ) {
    await this.userLevelRuleService.ensureCommentRateLimitInTx(tx, {
      userId,
      business: this.resolveLevelBusiness(targetType),
    })
  }

  private resolveLevelBusiness(targetType?: CommentTargetTypeEnum) {
    return targetType === CommentTargetTypeEnum.FORUM_TOPIC
      ? this.forumBusiness
      : null
  }
}
