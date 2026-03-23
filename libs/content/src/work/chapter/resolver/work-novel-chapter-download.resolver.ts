import type { Db } from '@db/core'
import {
  DrizzleService
 } from '@db/core'
import {
  DownloadService,
  DownloadTargetTypeEnum,
  IDownloadTargetResolver,
} from '@libs/interaction'
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

/**
 * 小说章节下载解析器
 */
@Injectable()
export class WorkNovelChapterDownloadResolver
  implements IDownloadTargetResolver, OnModuleInit
{
  /** 目标类型：小说章节 */
  readonly targetType = DownloadTargetTypeEnum.NOVEL_CHAPTER
  /** 作品类型：2 表示小说 */
  private readonly workType = 2

  constructor(
    private readonly downloadService: DownloadService,
    private readonly drizzle: DrizzleService,
  ) {}

  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  /**
   * 模块初始化时注册解析器
   */
  onModuleInit() {
    this.downloadService.registerResolver(this)
  }

  /**
   * 检查下载权限并获取内容
   */
  async ensureDownloadable(tx: Db, targetId: number) {
    const chapter = await tx.query.workChapter.findFirst({
      where: {
        id: targetId,
        workType: this.workType,
        deletedAt: { isNull: true },
      },
      columns: { content: true },
    })

    if (!chapter) {
      throw new NotFoundException('小说章节不存在')
    }

    if (!chapter.content) {
      throw new NotFoundException('下载内容不存在')
    }

    return chapter.content
  }

  /**
   * 更新下载计数
   */
  async applyCountDelta(
    tx: Db,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    const result = await tx
      .update(this.workChapter)
      .set({
        downloadCount: sql`${this.workChapter.downloadCount} + ${delta}`,
      })
      .where(
        and(
          eq(this.workChapter.id, targetId),
          eq(this.workChapter.workType, this.workType),
          isNull(this.workChapter.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '小说章节不存在')
  }
}
