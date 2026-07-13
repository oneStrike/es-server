import type { DbExecutor } from '@db/core'
import type { IDownloadTargetResolver } from '@libs/interaction/download/interfaces/download-target-resolver.type'
import { ContentPermissionService } from '@libs/content/permission/content-permission.service'
import { DownloadTargetTypeEnum } from '@libs/interaction/download/download.constant'
import { DownloadService } from '@libs/interaction/download/download.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { WorkCounterService } from '../../counter/work-counter.service'

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

  // 初始化 WorkNovelChapterDownloadResolver 依赖。
  constructor(
    private readonly downloadService: DownloadService,
    private readonly workCounterService: WorkCounterService,
    private readonly contentPermissionService: ContentPermissionService,
  ) {}

  // 模块初始化时注册解析器。
  onModuleInit() {
    this.downloadService.registerResolver(this)
  }

  // 检查下载权限并获取内容。
  async ensureDownloadable(tx: DbExecutor, targetId: number, userId: number) {
    const chapter = await tx.query.workChapter.findFirst({
      where: {
        id: targetId,
        workType: this.workType,
        deletedAt: { isNull: true },
      },
      columns: { novelContentPath: true },
    })

    if (!chapter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '小说章节不存在',
      )
    }

    if (!chapter.novelContentPath) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '下载内容不存在',
      )
    }

    await this.contentPermissionService.checkChapterDownload(userId, targetId)

    return chapter.novelContentPath
  }

  // 更新下载计数。
  async applyCountDelta(tx: DbExecutor, targetId: number, delta: number) {
    await this.workCounterService.updateWorkDownloadCountsByChapter(
      tx,
      targetId,
      this.workType,
      delta,
      '小说章节不存在',
      '小说作品不存在',
    )
  }
}
