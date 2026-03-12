import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ILikeTargetResolver } from './interfaces/like-target-resolver.interface'
import { LikeGrowthService } from './like-growth.service'
import { LikeTargetTypeEnum } from './like.constant'

/**
 * 点赞服务
 * 提供点赞、取消点赞、查询点赞状态等核心业务逻辑
 * 通过解析器模式支持多种目标类型（作品、章节、评论、论坛主题等）的点赞操作
 */
@Injectable()
export class LikeService extends BaseService {
  /** 目标类型到解析器的映射表，用于根据目标类型路由到对应的解析器 */
  private readonly resolvers = new Map<
    LikeTargetTypeEnum,
    ILikeTargetResolver
  >()

  constructor(private readonly likeGrowthService: LikeGrowthService) {
    super()
  }

  /**
   * 注册目标解析器
   * 供其他模块在应用启动时注册自己的点赞解析器
   * @param resolver - 点赞目标解析器实例
   */
  registerResolver(resolver: ILikeTargetResolver) {
    if (this.resolvers.has(resolver.targetType)) {
      console.warn(
        `Like resolver for type ${resolver.targetType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.targetType, resolver)
  }

  /**
   * 获取指定目标类型的解析器
   * @param targetType - 点赞目标类型
   * @returns 对应的目标解析器
   * @throws BadRequestException 当目标类型不支持时抛出异常
   */
  private getResolver(targetType: LikeTargetTypeEnum): ILikeTargetResolver {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BadRequestException('不支持的点赞目标类型')
    }
    return resolver
  }

  /**
   * 批量检查点赞状态
   * 用于在列表页批量查询用户对多个目标的点赞状态
   * @param targetType - 点赞目标类型
   * @param targetIds - 目标ID数组
   * @param userId - 用户ID
   * @returns 目标ID到点赞状态的映射Map（true表示已点赞）
   */
  async checkStatusBatch(
    targetType: LikeTargetTypeEnum,
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

    const likedSet = new Set(likes.map((item) => item.targetId))
    const statusMap = new Map<number, boolean>()

    for (const targetId of targetIds) {
      statusMap.set(targetId, likedSet.has(targetId))
    }

    return statusMap
  }

  /**
   * 获取目标的点赞列表
   * 查询指定目标的点赞记录，支持分页
   * @param targetType - 点赞目标类型
   * @param targetId - 目标ID
   * @param pageIndex - 页码（默认1）
   * @param pageSize - 每页数量（默认20）
   * @returns 分页点赞记录列表
   */
  async getTargetLikes(
    targetType: LikeTargetTypeEnum,
    targetId: number,
    pageIndex: number = 1,
    pageSize: number = 20,
  ) {
    return this.prisma.userLike.findPagination({
      where: {
        targetType,
        targetId,
        pageIndex,
        pageSize,
      } as any,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        sceneType: true,
        sceneId: true,
        commentLevel: true,
        createdAt: true,
      },
    })
  }

  /**
   * 点赞操作
   * 执行完整的点赞流程：解析目标元数据、创建点赞记录、更新计数、执行后置钩子、发放成长奖励
   * @param targetType - 点赞目标类型
   * @param targetId - 目标ID
   * @param userId - 用户ID
   * @throws BadRequestException 当已点赞或目标不存在时抛出异常
   */
  async like(
    targetType: LikeTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    const resolver = this.getResolver(targetType)

    await this.prisma.$transaction(async (tx) => {
      const targetMeta = await resolver.resolveMeta(tx, targetId)

      try {
        await tx.userLike.create({
          data: {
            targetType,
            targetId,
            sceneType: targetMeta.sceneType,
            sceneId: targetMeta.sceneId,
            commentLevel: targetMeta.commentLevel,
            userId,
          },
        })
      } catch (error) {
        this.handlePrismaBusinessError(error, {
          duplicateMessage: '已点赞',
        })
      }

      await resolver.applyCountDelta(tx, targetId, 1)

      if (resolver.postLikeHook) {
        await resolver.postLikeHook(tx, targetId, userId, targetMeta)
      }
    })

    await this.likeGrowthService.rewardLikeCreated(targetType, targetId, userId)
  }

  /**
   * 取消点赞操作
   * 执行完整的取消点赞流程：删除点赞记录、更新计数
   * @param targetType - 点赞目标类型
   * @param targetId - 目标ID
   * @param userId - 用户ID
   * @throws BadRequestException 当点赞记录不存在时抛出异常
   */
  async unlike(
    targetType: LikeTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    const resolver = this.getResolver(targetType)

    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.userLike.delete({
          where: {
            targetType_targetId_userId: {
              targetType,
              targetId,
              userId,
            },
          },
        })
      } catch (error) {
        this.handlePrismaBusinessError(error, {
          notFoundMessage: '点赞记录不存在',
        })
      }

      await resolver.applyCountDelta(tx, targetId, -1)
    })
  }

  /**
   * 检查点赞状态
   * 查询指定用户对指定目标的点赞状态
   * @param targetType - 点赞目标类型
   * @param targetId - 目标ID
   * @param userId - 用户ID
   * @returns 是否已点赞（true表示已点赞）
   */
  async checkLikeStatus(
    targetType: LikeTargetTypeEnum,
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
      select: { id: true },
    })
    return !!like
  }

  /**
   * 获取用户的点赞列表
   * 查询指定用户的点赞记录，支持分页，并关联查询目标详情
   * @param userId - 用户ID
   * @param targetType - 点赞目标类型
   * @param pageIndex - 页码（默认0）
   * @param pageSize - 每页数量（默认15）
   * @returns 分页点赞记录列表，包含目标详情
   */
  async getUserLikes(
    userId: number,
    targetType: LikeTargetTypeEnum,
    pageIndex: number = 0,
    pageSize: number = 15,
  ) {
    const page = await this.prisma.userLike.findPagination({
      where: {
        userId,
        targetType,
        pageIndex,
        pageSize,
      } as any,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        targetId: true,
        targetType: true,
        sceneType: true,
        sceneId: true,
        commentLevel: true,
        createdAt: true,
      },
    })

    if (page.list.length === 0) {
      return page
    }

    const resolver = this.getResolver(targetType)
    if (!resolver.batchGetDetails) {
      return page
    }

    const targetIds = [...new Set(page.list.map((item) => item.targetId))]
    if (targetIds.length === 0) {
      return page
    }

    const detailMap = await resolver.batchGetDetails(targetIds)
    if (!detailMap || detailMap.size === 0) {
      return page
    }

    return {
      ...page,
      list: page.list.map((item) => {
        const detail = detailMap.get(item.targetId)
        if (detail) {
          return {
            ...item,
            work: detail,
          }
        }
        return item
      }),
    }
  }
}
