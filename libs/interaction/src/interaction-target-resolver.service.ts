import {
  CommentLevelEnum,
  InteractionTargetTypeEnum,
  ReportTargetTypeEnum,
  SceneTypeEnum,
} from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

/**
 * 点赞目标解析结果。
 *
 * 说明：
 * - 统一承载点赞落库所需的场景维度
 * - `ownerUserId` 仅供内部校验和通知使用，不直接落库
 */
export interface ResolvedLikeTargetMeta {
  /** 目标所属业务场景类型 */
  sceneType: SceneTypeEnum
  /** 目标所属业务场景根对象 ID */
  sceneId: number
  /** 评论层级，仅评论目标时有值 */
  commentLevel?: CommentLevelEnum
  /** 目标拥有者用户 ID，仅部分目标可解析 */
  ownerUserId?: number
}

/**
 * 举报目标解析结果。
 *
 * 说明：
 * - 统一承载举报落库所需的场景维度
 * - `ownerUserId` 用于自举报拦截等业务校验
 */
export interface ResolvedReportTargetMeta {
  /** 目标所属业务场景类型 */
  sceneType: SceneTypeEnum
  /** 目标所属业务场景根对象 ID */
  sceneId: number
  /** 评论层级，仅评论目标时有值 */
  commentLevel?: CommentLevelEnum
  /** 目标拥有者用户 ID，仅部分目标可解析 */
  ownerUserId?: number
}

/**
 * 统一交互目标解析服务。
 *
 * 说明：
 * - 负责校验目标是否存在
 * - 负责补齐 `sceneType`、`sceneId`、`commentLevel`
 * - 负责把评论目标还原成其真实挂载场景
 */
@Injectable()
export class InteractionTargetResolverService extends BaseService {
  /**
   * 解析点赞目标元数据。
   */
  async resolveLikeTargetMeta(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<ResolvedLikeTargetMeta> {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
        await this.ensureWorkExists(targetId, 1)
        return {
          sceneType: SceneTypeEnum.COMIC_WORK,
          sceneId: targetId,
        }
      case InteractionTargetTypeEnum.NOVEL:
        await this.ensureWorkExists(targetId, 2)
        return {
          sceneType: SceneTypeEnum.NOVEL_WORK,
          sceneId: targetId,
        }
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
        await this.ensureChapterExists(targetId, 1)
        return {
          sceneType: SceneTypeEnum.COMIC_CHAPTER,
          sceneId: targetId,
        }
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        await this.ensureChapterExists(targetId, 2)
        return {
          sceneType: SceneTypeEnum.NOVEL_CHAPTER,
          sceneId: targetId,
        }
      case InteractionTargetTypeEnum.FORUM_TOPIC: {
        const topic = await this.ensureForumTopicExists(targetId)
        return {
          sceneType: SceneTypeEnum.FORUM_TOPIC,
          sceneId: targetId,
          ownerUserId: topic.userId,
        }
      }
      case InteractionTargetTypeEnum.COMMENT:
        return this.resolveCommentTargetMeta(targetId)
      default:
        throw new BadRequestException('不支持的点赞目标类型')
    }
  }

  /**
   * 解析举报目标元数据。
   */
  async resolveReportTargetMeta(
    targetType: ReportTargetTypeEnum,
    targetId: number,
  ): Promise<ResolvedReportTargetMeta> {
    switch (targetType) {
      case ReportTargetTypeEnum.COMIC:
        await this.ensureWorkExists(targetId, 1)
        return {
          sceneType: SceneTypeEnum.COMIC_WORK,
          sceneId: targetId,
        }
      case ReportTargetTypeEnum.NOVEL:
        await this.ensureWorkExists(targetId, 2)
        return {
          sceneType: SceneTypeEnum.NOVEL_WORK,
          sceneId: targetId,
        }
      case ReportTargetTypeEnum.COMIC_CHAPTER:
        await this.ensureChapterExists(targetId, 1)
        return {
          sceneType: SceneTypeEnum.COMIC_CHAPTER,
          sceneId: targetId,
        }
      case ReportTargetTypeEnum.NOVEL_CHAPTER:
        await this.ensureChapterExists(targetId, 2)
        return {
          sceneType: SceneTypeEnum.NOVEL_CHAPTER,
          sceneId: targetId,
        }
      case ReportTargetTypeEnum.FORUM_TOPIC: {
        const topic = await this.ensureForumTopicExists(targetId)
        return {
          sceneType: SceneTypeEnum.FORUM_TOPIC,
          sceneId: targetId,
          ownerUserId: topic.userId,
        }
      }
      case ReportTargetTypeEnum.COMMENT:
        return this.resolveCommentTargetMeta(targetId)
      case ReportTargetTypeEnum.USER:
        await this.ensureUserExists(targetId)
        return {
          sceneType: SceneTypeEnum.USER_PROFILE,
          sceneId: targetId,
          ownerUserId: targetId,
        }
      default:
        throw new BadRequestException('不支持的举报目标类型')
    }
  }

  /**
   * 解析评论目标元数据。
   *
   * 说明：
   * - 评论本身只是一层多态壳，真实统计维度要回看评论挂载的目标
   * - 根评论和回复评论由 `replyToId` 是否为空决定
   */
  private async resolveCommentTargetMeta(
    targetId: number,
  ): Promise<ResolvedLikeTargetMeta & ResolvedReportTargetMeta> {
    const comment = await this.prisma.userComment.findFirst({
      where: { id: targetId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        targetType: true,
        targetId: true,
        replyToId: true,
      },
    })

    if (!comment) {
      throw new NotFoundException('评论不存在')
    }

    const sceneType = this.mapCommentTargetTypeToSceneType(comment.targetType)
    const commentLevel = comment.replyToId
      ? CommentLevelEnum.REPLY
      : CommentLevelEnum.ROOT

    return {
      sceneType,
      sceneId: comment.targetId,
      commentLevel,
      ownerUserId: comment.userId,
    }
  }

  /**
   * 将评论挂载目标类型转换为统一场景类型。
   */
  private mapCommentTargetTypeToSceneType(
    targetType: InteractionTargetTypeEnum,
  ): SceneTypeEnum {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
        return SceneTypeEnum.COMIC_WORK
      case InteractionTargetTypeEnum.NOVEL:
        return SceneTypeEnum.NOVEL_WORK
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
        return SceneTypeEnum.COMIC_CHAPTER
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        return SceneTypeEnum.NOVEL_CHAPTER
      case InteractionTargetTypeEnum.FORUM_TOPIC:
        return SceneTypeEnum.FORUM_TOPIC
      case InteractionTargetTypeEnum.COMMENT:
        throw new BadRequestException('评论不能继续挂载评论作为场景目标')
      default:
        throw new BadRequestException('评论挂载的目标类型不合法')
    }
  }

  /**
   * 校验作品是否存在且类型匹配。
   */
  private async ensureWorkExists(targetId: number, workType: number) {
    const work = await this.prisma.work.findFirst({
      where: { id: targetId, type: workType, deletedAt: null },
      select: { id: true },
    })

    if (!work) {
      throw new NotFoundException('作品不存在')
    }

    return work
  }

  /**
   * 校验章节是否存在且作品类型匹配。
   */
  private async ensureChapterExists(targetId: number, workType: number) {
    const chapter = await this.prisma.workChapter.findFirst({
      where: { id: targetId, workType, deletedAt: null },
      select: { id: true },
    })

    if (!chapter) {
      throw new NotFoundException('章节不存在')
    }

    return chapter
  }

  /**
   * 校验论坛主题是否存在。
   */
  private async ensureForumTopicExists(targetId: number) {
    const topic = await this.prisma.forumTopic.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true, userId: true },
    })

    if (!topic) {
      throw new NotFoundException('论坛主题不存在')
    }

    return topic
  }

  /**
   * 校验用户是否存在。
   */
  private async ensureUserExists(targetId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: targetId },
      select: { id: true },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return user
  }
}
