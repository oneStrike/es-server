import type { DbTransaction } from '@db/core'
import type { CommentRateLimitLockPlan } from '@libs/growth/level-rule/level-rule.type'
import { DrizzleService } from '@db/core'
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
    private readonly userLevelRuleService: UserLevelRuleService,
  ) {}

  private readonly forumBusiness = 'forum'

  private get db() {
    return this.drizzle.db
  }

  async ensureCanComment(userId: number) {
    await this.ensureUserCanComment(userId)
  }

  async ensureUserCanComment(userId: number) {
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
  }

  // 在评论事务外构建等级额度与发帖间隔锁计划。
  buildCommentRateLimitLockPlan(
    userId: number,
    targetType: CommentTargetTypeEnum,
  ): CommentRateLimitLockPlan {
    return this.userLevelRuleService.buildCommentRateLimitLockPlan({
      userId,
      business: this.resolveLevelBusiness(targetType),
    })
  }

  // outer owner 持有完整 union 后执行评论等级频控校验。
  async ensureCommentRateLimitAfterLockInTx(
    tx: DbTransaction,
    plan: CommentRateLimitLockPlan,
  ) {
    await this.userLevelRuleService.ensureCommentRateLimitAfterLockInTx(
      tx,
      plan,
    )
  }

  private resolveLevelBusiness(targetType?: CommentTargetTypeEnum) {
    return targetType === CommentTargetTypeEnum.FORUM_TOPIC
      ? this.forumBusiness
      : null
  }
}
