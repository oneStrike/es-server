import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import {
  DownloadService,
  DownloadTargetTypeEnum,
  IDownloadTargetResolver,
} from '@libs/interaction/download'
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { WorkCounterService } from '../../counter/work-counter.service'

/**
 * 漫画章节下载解析器
 */
@Injectable()
export class WorkComicChapterDownloadResolver
  implements IDownloadTargetResolver, OnModuleInit
{
  /** 目标类型：漫画章节 */
  readonly targetType = DownloadTargetTypeEnum.COMIC_CHAPTER
  /** 作品类型：1 表示漫画 */
  private readonly workType = 1

  constructor(
    private readonly downloadService: DownloadService,
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
      throw new NotFoundException('漫画章节不存在')
    }

    if (!chapter.content) {
      throw new NotFoundException('下载内容不存在')
    }

    return chapter.content
  }

  /**
   * 更新下载计数
   */
  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    await this.workCounterService.updateWorkDownloadCountsByChapter(
      tx,
      targetId,
      this.workType,
      delta,
      '漫画章节不存在',
      '漫画作品不存在',
    )
  }
}
