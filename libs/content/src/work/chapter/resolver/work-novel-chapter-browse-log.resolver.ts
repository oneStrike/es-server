import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import {
  BrowseLogService,
  BrowseLogTargetTypeEnum,
  IBrowseLogTargetResolver,
} from '@libs/interaction/browse-log'
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { WorkCounterService } from '../../counter/work-counter.service'

/**
 * 小说章节浏览日志解析器
 * 处理小说章节的浏览记录相关操作
 */
@Injectable()
export class WorkNovelChapterBrowseLogResolver
  implements IBrowseLogTargetResolver, OnModuleInit
{
  /** 目标类型：小说章节 */
  readonly targetType = BrowseLogTargetTypeEnum.NOVEL_CHAPTER
  /** 作品类型：2 表示小说 */
  private readonly workType = 2

  constructor(
    private readonly browseLogService: BrowseLogService,
    private readonly drizzle: DrizzleService,
    private readonly workCounterService: WorkCounterService,
  ) {}

  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  /**
   * 模块初始化时注册解析器
   */
  onModuleInit() {
    this.browseLogService.registerResolver(this)
  }

  /**
   * 应用浏览计数增量
   * 更新小说章节的浏览数
   *
   * @param tx - 事务客户端
   * @param targetId - 目标章节ID
   * @param delta - 变更量
   */
  applyCountDelta: (tx: Db, targetId: number, delta: number) => Promise<void> =
    async (tx, targetId, delta) => {
      await this.workCounterService.updateWorkChapterViewCount(
        tx,
        targetId,
        this.workType,
        delta,
        '小说章节不存在',
      )
    }

  /**
   * 校验小说章节是否有效
   *
   * @param tx - 事务客户端
   * @param targetId - 目标章节ID
   * @throws 当章节不存在时抛出 BadRequestException
   */
  ensureTargetValid: (tx: Db, targetId: number) => Promise<void> = async (
    tx,
    targetId,
  ) => {
    const chapter = await tx
      .select({ id: this.workChapter.id })
      .from(this.workChapter)
      .where(
        and(
          eq(this.workChapter.id, targetId),
          eq(this.workChapter.workType, this.workType),
          isNull(this.workChapter.deletedAt),
        ),
      )
      .limit(1)

    if (!chapter[0]) {
      throw new NotFoundException('小说章节不存在')
    }
  }
}
