import type { Db } from '@db/core'
import {
  CommentService,
  CommentTargetTypeEnum,
  ICommentTargetResolver,
} from '@libs/interaction/comment'
import { AuditStatusEnum } from '@libs/platform/constant'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { ForumCounterService } from '../../counter/forum-counter.service'

/**
 * 论坛帖子评论解析器
 * 处理论坛帖子的评论相关操作
 */
@Injectable()
export class ForumTopicCommentResolver
  implements ICommentTargetResolver, OnModuleInit
{
  /** 目标类型：论坛帖子 */
  readonly targetType = CommentTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly commentService: CommentService,
    private readonly forumCounterService: ForumCounterService,
  ) {}

  /**
   * 模块初始化时注册解析器
   */
  onModuleInit() {
    this.commentService.registerResolver(this)
  }

  /**
   * 应用评论计数增量
   * 论坛主题的用户评论计数由 CommentService 统一维护
   *
   * @param _tx - 事务客户端
   * @param _targetId - 目标帖子ID
   * @param _delta - 变更量（+1 增加，-1 减少）
   */
  async applyCountDelta(
    _tx: Db,
    _targetId: number,
    _delta: number,
  ) {}

  /**
   * 校验是否允许对该帖子发表评论
   * 检查帖子是否存在、是否被锁定
   *
   * @param tx - 事务客户端
   * @param targetId - 目标帖子ID
   * @throws 当帖子不存在或被锁定时抛出 BadRequestException
   */
  async ensureCanComment(tx: Db, targetId: number) {
    const topic = await tx.query.forumTopic.findFirst({
      where: {
        id: targetId,
        deletedAt: { isNull: true },
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
      },
      columns: { isLocked: true },
      with: {
        section: {
          columns: {
            isEnabled: true,
            deletedAt: true,
          },
        },
      },
    })

    if (!topic || !topic.section || topic.section.deletedAt || !topic.section.isEnabled) {
      throw new BadRequestException('帖子不存在')
    }

    if (topic.isLocked) {
      throw new BadRequestException('帖子已被锁定，无法评论')
    }
  }

  /**
   * 解析帖子的元信息
   * 获取帖子作者ID，用于发送被评论通知
   *
   * @param tx - 事务客户端
   * @param targetId - 目标帖子ID
   * @returns 目标元信息，包含所有者用户ID
   */
  async resolveMeta(tx: Db, targetId: number) {
    const topic = await tx.query.forumTopic.findFirst({
      where: {
        id: targetId,
        deletedAt: { isNull: true },
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
      },
      columns: { userId: true, sectionId: true },
      with: {
        section: {
          columns: {
            isEnabled: true,
            deletedAt: true,
          },
        },
      },
    })

    if (!topic || !topic.section || topic.section.deletedAt || !topic.section.isEnabled) {
      throw new BadRequestException('帖子不存在')
    }

    return {
      ownerUserId: topic.userId,
      sectionId: topic.sectionId,
    }
  }

  async postCommentHook(
    tx: Db,
    targetId: number,
    _actorUserId: number,
    meta: { sectionId?: number },
  ) {
    if (!meta.sectionId) {
      throw new BadRequestException('帖子板块信息缺失')
    }

    await this.forumCounterService.syncTopicCommentState(tx, targetId)
    await this.forumCounterService.syncSectionVisibleState(tx, meta.sectionId)
  }

  async postDeleteCommentHook(
    tx: Db,
    comment: {
      userId: number
      targetId: number
    },
    meta: { sectionId?: number },
  ) {
    if (!meta.sectionId) {
      throw new BadRequestException('帖子板块信息缺失')
    }

    await this.forumCounterService.syncTopicCommentState(tx, comment.targetId)
    await this.forumCounterService.syncSectionVisibleState(tx, meta.sectionId)
  }
}

