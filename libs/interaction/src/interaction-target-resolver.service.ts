import {
  CommentLevelEnum,
  InteractionTargetTypeEnum,
  SceneTypeEnum,
} from '@libs/platform/constant'
import { PlatformService } from '@libs/platform/database'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InteractionTargetAccessService } from './interaction-target-access.service'
import {
  mapInteractionTargetTypeToSceneType,
  mapReportTargetTypeToInteractionTargetType,
} from './interaction-target.definition'
import { ReportTargetTypeEnum } from './report/report.constant'

export interface ResolvedLikeTargetMeta {
  sceneType: SceneTypeEnum
  sceneId: number
  commentLevel?: CommentLevelEnum
  ownerUserId?: number
}

export interface ResolvedReportTargetMeta {
  sceneType: SceneTypeEnum
  sceneId: number
  commentLevel?: CommentLevelEnum
  ownerUserId?: number
}

@Injectable()
export class InteractionTargetResolverService extends PlatformService {
  constructor(
    private readonly interactionTargetAccessService: InteractionTargetAccessService,
  ) {
    super()
  }

  /**
   * Resolve like target to a stable scene dimension used by persistence.
   */
  async resolveLikeTargetMeta(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<ResolvedLikeTargetMeta> {
    if (targetType === InteractionTargetTypeEnum.COMMENT) {
      return this.resolveCommentTargetMeta(targetId)
    }

    const sceneType = mapInteractionTargetTypeToSceneType(targetType)
    if (!sceneType) {
      throw new BadRequestException('不支持的点赞目标类型')
    }

    if (targetType === InteractionTargetTypeEnum.FORUM_TOPIC) {
      const topic = await this.interactionTargetAccessService.ensureTargetExists<{
        userId: number
      }>(this.prisma, targetType, targetId, {
        select: { userId: true },
      })

      return {
        sceneType,
        sceneId: targetId,
        ownerUserId: topic.userId,
      }
    }

    await this.interactionTargetAccessService.ensureTargetExists(
      this.prisma,
      targetType,
      targetId,
    )

    return {
      sceneType,
      sceneId: targetId,
    }
  }

  /**
   * Resolve report target to scene dimensions and owner when needed.
   */
  async resolveReportTargetMeta(
    targetType: ReportTargetTypeEnum,
    targetId: number,
  ): Promise<ResolvedReportTargetMeta> {
    if (targetType === ReportTargetTypeEnum.USER) {
      await this.ensureUserExists(targetId)
      return {
        sceneType: SceneTypeEnum.USER_PROFILE,
        sceneId: targetId,
        ownerUserId: targetId,
      }
    }

    const interactionTargetType =
      mapReportTargetTypeToInteractionTargetType(targetType)

    if (!interactionTargetType) {
      throw new BadRequestException('不支持的举报目标类型')
    }

    if (interactionTargetType === InteractionTargetTypeEnum.COMMENT) {
      return this.resolveCommentTargetMeta(targetId)
    }

    const sceneType = mapInteractionTargetTypeToSceneType(interactionTargetType)
    if (!sceneType) {
      throw new BadRequestException('不支持的举报目标类型')
    }

    if (interactionTargetType === InteractionTargetTypeEnum.FORUM_TOPIC) {
      const topic = await this.interactionTargetAccessService.ensureTargetExists<{
        userId: number
      }>(this.prisma, interactionTargetType, targetId, {
        select: { userId: true },
      })

      return {
        sceneType,
        sceneId: targetId,
        ownerUserId: topic.userId,
      }
    }

    await this.interactionTargetAccessService.ensureTargetExists(
      this.prisma,
      interactionTargetType,
      targetId,
    )

    return {
      sceneType,
      sceneId: targetId,
    }
  }

  /**
   * Comment is a polymorphic shell; scene dimensions come from its parent target.
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

  private mapCommentTargetTypeToSceneType(
    targetType: InteractionTargetTypeEnum,
  ): SceneTypeEnum {
    if (targetType === InteractionTargetTypeEnum.COMMENT) {
      throw new BadRequestException(
        '评论不能继续挂载评论作为场景目标',
      )
    }

    const sceneType = mapInteractionTargetTypeToSceneType(targetType)
    if (!sceneType) {
      throw new BadRequestException('评论挂载的目标类型不合法')
    }

    return sceneType
  }

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
