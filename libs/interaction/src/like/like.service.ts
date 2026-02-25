import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@libs/base/database'
import { BaseInteractionService } from '../base-interaction.service'
import { CounterService } from '../counter/counter.service'
import { InteractionTargetType } from '../interaction.constant'
import { TargetValidatorRegistry } from '../validator/target-validator.registry'
import type {
  LikeListQueryDto,
  LikeRecordResponseDto,
  LikeStatusQueryDto,
  LikeStatusResponseDto,
} from './dto/like.dto'

/**
 * 点赞服务
 * 处理点赞相关的所有业务逻辑
 */
@Injectable()
export class LikeService extends BaseInteractionService {
  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly counterService: CounterService,
    protected readonly validatorRegistry: TargetValidatorRegistry,
  ) {
    super()
  }

  /**
   * 检查用户是否已点赞
   */
  protected async checkUserInteracted(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<boolean> {
    const like = await this.prisma.userLike.findUnique({
      where: {
        targetType_targetId_userId: {
          targetType,
          targetId,
          userId,
        },
      },
    })
    return !!like
  }

  /**
   * 创建点赞记录
   */
  protected async createInteraction(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.prisma.userLike.create({
      data: {
        targetType,
        targetId,
        userId,
      },
    })
  }

  /**
   * 删除点赞记录
   */
  protected async deleteInteraction(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.prisma.userLike.delete({
      where: {
        targetType_targetId_userId: {
          targetType,
          targetId,
          userId,
        },
      },
    })
  }

  /**
   * 获取计数字段名
   */
  protected getCountField(): string {
    return 'likeCount'
  }

  /**
   * 批量检查点赞状态
   */
  async checkStatusBatch(
    targetType: InteractionTargetType,
    targetIds: number[],
    userId: number,
  ): Promise<Map<number, boolean>> {
    if (targetIds.length === 0) {
      return new Map()
    }

    const likes = await this.prisma.userLike.findMany({
      where: {
        targetType,
        targetId: { in: targetIds },
        userId,
      },
      select: {
        targetId: true,
      },
    })

    const likedSet = new Set(likes.map((l) => l.targetId))
    const statusMap = new Map<number, boolean>()

    for (const targetId of targetIds) {
      statusMap.set(targetId, likedSet.has(targetId))
    }

    return statusMap
  }

  /**
   * 获取用户的点赞列表
   */
  async getUserLikes(
    userId: number,
    query: LikeListQueryDto,
  ): Promise<{ list: LikeRecordResponseDto[]; total: number }> {
    const { targetType, page = 1, pageSize = 20 } = query

    const where = {
      userId,
      ...(targetType !== undefined && { targetType }),
    }

    const [likes, total] = await Promise.all([
      this.prisma.userLike.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userLike.count({ where }),
    ])

    const list: LikeRecordResponseDto[] = likes.map((like) => ({
      id: like.id,
      targetType: like.targetType as InteractionTargetType,
      targetId: like.targetId,
      createdAt: like.createdAt,
    }))

    return { list, total }
  }

  /**
   * 获取目标的点赞用户列表
   */
  async getTargetLikes(
    targetType: InteractionTargetType,
    targetId: number,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ list: { userId: number; createdAt: Date }[]; total: number }> {
    const where = {
      targetType,
      targetId,
    }

    const [likes, total] = await Promise.all([
      this.prisma.userLike.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          userId: true,
          createdAt: true,
        },
      }),
      this.prisma.userLike.count({ where }),
    ])

    return { list: likes, total }
  }

  /**
   * 获取目标的点赞数
   */
  async getLikeCount(
    targetType: InteractionTargetType,
    targetId: number,
  ): Promise<number> {
    return this.getCount(targetType, targetId)
  }

  /**
   * 批量获取点赞数
   */
  async getLikeCounts(
    targetType: InteractionTargetType,
    targetIds: number[],
  ): Promise<Map<number, number>> {
    return this.getCounts(targetType, targetIds)
  }

  /**
   * 点赞
   */
  async like(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    return this.interact(targetType, targetId, userId)
  }

  /**
   * 取消点赞
   */
  async unlike(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    return this.cancelInteract(targetType, targetId, userId)
  }

  /**
   * 检查点赞状态
   */
  async checkLikeStatus(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<boolean> {
    return this.checkStatus(targetType, targetId, userId)
  }
}
