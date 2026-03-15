import type { PrismaTransactionClientType } from '@libs/platform/database'
import {
  DownloadService,
  DownloadTargetTypeEnum,
  IDownloadTargetResolver,
} from '@libs/interaction'
import { PlatformService } from '@libs/platform/database'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'

/**
 * 漫画章节下载解析器
 */
@Injectable()
export class WorkComicChapterDownloadResolver
  extends PlatformService
  implements IDownloadTargetResolver, OnModuleInit
{
  /** 目标类型：漫画章节 */
  readonly targetType = DownloadTargetTypeEnum.COMIC_CHAPTER
  /** 作品类型：1 表示漫画 */
  private readonly workType = 1

  constructor(private readonly downloadService: DownloadService) {
    super()
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
  async ensureDownloadable(tx: PrismaTransactionClientType, targetId: number) {
    const chapter = await tx.workChapter.findFirst({
      where: {
        id: targetId,
        workType: this.workType,
        deletedAt: null,
      },
      select: { content: true },
    })

    if (!chapter) {
      throw new BadRequestException('漫画章节不存在')
    }

    if (!chapter.content) {
      throw new BadRequestException('下载内容不存在')
    }

    return chapter.content
  }

  /**
   * 更新下载计数
   */
  async applyCountDelta(
    tx: PrismaTransactionClientType,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    await tx.workChapter.applyCountDelta(
      {
        id: targetId,
        workType: this.workType,
        deletedAt: null,
      },
      'downloadCount',
      delta,
    )
  }
}
