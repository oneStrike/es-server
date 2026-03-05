import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { AuditStatus, InteractionTargetType } from '../common.constant'

@Injectable()
export class CommentCountService extends BaseService {
  /**
   * 判断评论在前台是否可见�?
   */
  isVisible(comment: {
    auditStatus: number
    isHidden: boolean
    deletedAt: Date | null
  }) {
    return (
      comment.auditStatus === AuditStatus.APPROVED &&
      !comment.isHidden &&
      comment.deletedAt === null
    )
  }

  private getTargetCountModel(tx: any, targetType: InteractionTargetType) {
    switch (targetType) {
      case InteractionTargetType.COMIC:
      case InteractionTargetType.NOVEL:
        return tx.work
      case InteractionTargetType.COMIC_CHAPTER:
      case InteractionTargetType.NOVEL_CHAPTER:
        return tx.workChapter
      case InteractionTargetType.FORUM_TOPIC:
        return tx.forumTopic
      default:
        throw new BadRequestException('Unsupported target type')
    }
  }

  /**
   * 统一更新目标评论计数，减少重复更新逻辑�?
   */
  async applyCommentCountDelta(
    tx: any,
    targetType: InteractionTargetType,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    const model = this.getTargetCountModel(tx, targetType)

    if (delta > 0) {
      await model.update({
        where: { id: targetId },
        data: {
          commentCount: {
            increment: delta,
          },
        },
      })
      return
    }

    const amount = Math.abs(delta)
    await model.updateMany({
      where: {
        id: targetId,
        commentCount: { gte: amount },
      },
      data: {
        commentCount: {
          decrement: amount,
        },
      },
    })
  }

  async setCommentCount(
    targetType: InteractionTargetType,
    targetId: number,
    count: number,
  ) {
    const model = this.getTargetCountModel(this.prisma, targetType)
    await model.update({
      where: { id: targetId },
      data: { commentCount: count },
    })
  }

  /**
   * 根据前后可见性变化同步目标计数�?
   */
  async syncVisibleCountByTransition(
    tx: any,
    targetType: InteractionTargetType,
    targetId: number,
    beforeVisible: boolean,
    afterVisible: boolean,
  ) {
    if (beforeVisible === afterVisible) {
      return
    }

    await this.applyCommentCountDelta(
      tx,
      targetType,
      targetId,
      afterVisible ? 1 : -1,
    )
  }
}
