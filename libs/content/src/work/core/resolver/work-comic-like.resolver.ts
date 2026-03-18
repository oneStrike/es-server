import { DrizzleService } from '@db/core'
import { work } from '@db/schema'
import {
  ILikeTargetResolver,
  InteractionTx,
  LikeService,
  LikeTargetTypeEnum,
} from '@libs/interaction'
import { SceneTypeEnum } from '@libs/platform/constant'
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

/**
 * 漫画作品点赞解析器
 * 负责处理漫画作品的点赞业务逻辑，包括验证作品存在性、解析场景元数据、更新点赞计数、批量获取作品详情等
 */
@Injectable()
export class WorkComicLikeResolver
  implements ILikeTargetResolver, OnModuleInit
{
  /** 目标类型：漫画作品 */
  readonly targetType = LikeTargetTypeEnum.WORK_COMIC

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly likeService: LikeService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  /**
   * 模块初始化时注册解析器到点赞服务
   * 使点赞服务能够识别并处理漫画作品类型的点赞请求
   */
  onModuleInit() {
    this.likeService.registerResolver(this)
  }

  /**
   * 解析目标漫画作品的场景元数据
   * 验证作品存在性并返回场景类型和场景ID，用于统一交互记录的场景标识
   * @param tx - 事务客户端
   * @param targetId - 作品ID
   * @returns 包含场景类型和场景ID的元数据对象
   * @throws NotFoundException 当作品不存在时抛出异常
   */
  async resolveMeta(tx: InteractionTx, targetId: number) {
    const target = await tx.query.work.findFirst({
      where: {
        id: targetId,
        type: this.targetType,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!target) {
      throw new NotFoundException('漫画作品不存在')
    }

    return {
      sceneType: SceneTypeEnum.COMIC_WORK,
      sceneId: targetId,
    }
  }

  /**
   * 应用点赞计数增量
   * 当用户点赞或取消点赞时，更新漫画作品的点赞计数
   * @param tx - 事务客户端
   * @param targetId - 作品ID
   * @param delta - 计数变化量（+1 表示点赞，-1 表示取消点赞）
   */
  async applyCountDelta(
    tx: InteractionTx,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    await this.drizzle.withErrorHandling(() =>
      tx
        .update(work)
        .set({
          likeCount: sql`${work.likeCount} + ${delta}`,
        })
        .where(
          and(
            eq(work.id, targetId),
            eq(work.type, this.targetType),
            isNull(work.deletedAt),
          ),
        ),
    )
    const updated = await tx.query.work.findFirst({
      where: {
        id: targetId,
        type: this.targetType,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })
    if (!updated) {
      throw new NotFoundException('漫画作品不存在')
    }
  }

  /**
   * 批量获取漫画作品详情
   * 用于在点赞列表或通知中展示作品的名称、封面等基本信息
   * @param targetIds - 作品ID数组
   * @returns 作品ID到作品详情的映射Map
   */
  async batchGetDetails(targetIds: number[]) {
    if (targetIds.length === 0) {
      return new Map()
    }

    const works = await this.db.query.work.findMany({
      where: {
        id: { in: targetIds },
        type: this.targetType,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        name: true,
        cover: true,
      },
    })

    return new Map(works.map((work) => [work.id, work]))
  }
}
