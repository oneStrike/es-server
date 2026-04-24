import type { Db } from '@db/core'
import { ILikeTargetResolver } from '@libs/interaction/like/interfaces/like-target-resolver.interface'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { LikeService } from '@libs/interaction/like/like.service'
import { BusinessErrorCode, SceneTypeEnum } from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { WorkCounterService } from '../../counter/work-counter.service'

/**
 * 小说章节点赞解析器
 * 负责处理小说章节的点赞业务逻辑，包括验证章节存在性、解析场景元数据、更新点赞计数等
 */
@Injectable()
export class WorkNovelChapterLikeResolver
  implements ILikeTargetResolver, OnModuleInit
{
  /** 目标类型：小说章节 */
  readonly targetType = LikeTargetTypeEnum.WORK_NOVEL_CHAPTER
  /** 作品类型：2 表示小说 */
  private readonly workType = 2

  constructor(
    private readonly likeService: LikeService,
    private readonly workCounterService: WorkCounterService,
  ) {}

  /**
   * 模块初始化时注册解析器到点赞服务
   * 使点赞服务能够识别并处理小说章节类型的点赞请求
   */
  onModuleInit() {
    this.likeService.registerResolver(this)
  }

  /**
   * 解析目标小说章节的场景元数据
   * 验证章节存在性并返回场景类型和场景ID，用于统一交互记录的场景标识
   * @param tx - 事务客户端
   * @param targetId - 章节ID
   * @returns 包含场景类型和场景ID的元数据对象
   * @throws BusinessException 当章节不存在时抛出异常
   */
  async resolveMeta(tx: Db, targetId: number) {
    const chapter = await tx.query.workChapter.findFirst({
      where: {
        id: targetId,
        workType: this.workType,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!chapter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '小说章节不存在',
      )
    }

    return {
      sceneType: SceneTypeEnum.NOVEL_CHAPTER,
      sceneId: targetId,
    }
  }

  /**
   * 应用点赞计数增量
   * 当用户点赞或取消点赞时，更新小说章节的点赞计数
   * @param tx - 事务客户端
   * @param targetId - 章节ID
   * @param delta - 计数变化量（+1 表示点赞，-1 表示取消点赞）
   */
  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    await this.workCounterService.updateWorkChapterLikeCount(
      tx,
      targetId,
      this.workType,
      delta,
      '小说章节不存在',
    )
  }
}
