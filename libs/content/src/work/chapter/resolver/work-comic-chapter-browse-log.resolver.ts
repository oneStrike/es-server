import { DrizzleService } from '@db/core'
import {
  BrowseLogService,
  BrowseLogTargetTypeEnum,
  IBrowseLogTargetResolver,
  InteractionTx,
} from '@libs/interaction'
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

/**
 * 漫画章节浏览日志解析器
 * 处理漫画章节的浏览记录相关操作
 */
@Injectable()
export class WorkComicChapterBrowseLogResolver
  implements IBrowseLogTargetResolver, OnModuleInit
{
  /** 目标类型：漫画章节 */
  readonly targetType = BrowseLogTargetTypeEnum.COMIC_CHAPTER
  /** 作品类型：1 表示漫画 */
  private readonly workType = 1

  constructor(
    private readonly browseLogService: BrowseLogService,
    private readonly drizzle: DrizzleService,
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
   * 更新漫画章节的浏览数
   *
   * @param tx - 事务客户端
   * @param targetId - 目标章节ID
   * @param delta - 变更量
   */
  applyCountDelta: (
    tx: InteractionTx,
    targetId: number,
    delta: number,
  ) => Promise<void> = async (tx, targetId, delta) => {
    if (delta === 0) {
      return
    }

    const result = await tx
      .update(this.workChapter)
      .set({
        viewCount: sql`${this.workChapter.viewCount} + ${delta}`,
      })
      .where(
        and(
          eq(this.workChapter.id, targetId),
          eq(this.workChapter.workType, this.workType),
          isNull(this.workChapter.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '漫画章节不存在')
  }

  /**
   * 校验漫画章节是否有效
   *
   * @param tx - 事务客户端
   * @param targetId - 目标章节ID
   * @throws 当章节不存在时抛出 BadRequestException
   */
  ensureTargetValid: (
    tx: InteractionTx,
    targetId: number,
  ) => Promise<void> = async (tx, targetId) => {
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
      throw new NotFoundException('漫画章节不存在')
    }
  }
}
