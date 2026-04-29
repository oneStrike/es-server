import type { Db } from '@db/core'
import { ILikeTargetResolver } from '@libs/interaction/like/interfaces/like-target-resolver.interface'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { LikeService } from '@libs/interaction/like/like.service'
import { BusinessErrorCode, SceneTypeEnum } from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { WorkCounterService } from '../../counter/work-counter.service'

/**
 * 漫画章节点赞解析器
 * 负责处理漫画章节的点赞业务逻辑，包括验证章节存在性、解析场景元数据、更新点赞计数等
 */
@Injectable()
export class WorkComicChapterLikeResolver
  implements ILikeTargetResolver, OnModuleInit
{
  /** 目标类型：漫画章节 */
  readonly targetType = LikeTargetTypeEnum.WORK_COMIC_CHAPTER
  /** 作品类型：1 表示漫画 */
  private readonly workType = 1

  // 初始化 WorkComicChapterLikeResolver 依赖。
  constructor(
    private readonly likeService: LikeService,
    private readonly workCounterService: WorkCounterService,
  ) {}

  // 模块初始化时注册解析器到点赞服务，使点赞服务能够识别并处理漫画章节类型的点赞请求。
  onModuleInit() {
    this.likeService.registerResolver(this)
  }

  // 解析目标漫画章节的场景元数据，验证章节存在性并返回场景类型和场景ID，用于统一交互记录的场景标识。
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
        '漫画章节不存在',
      )
    }

    return {
      sceneType: SceneTypeEnum.COMIC_CHAPTER,
      sceneId: targetId,
    }
  }

  // 应用点赞计数增量，当用户点赞或取消点赞时，更新漫画章节的点赞计数。
  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    await this.workCounterService.updateWorkChapterLikeCount(
      tx,
      targetId,
      this.workType,
      delta,
      '漫画章节不存在',
    )
  }
}
