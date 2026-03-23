import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ComicArchiveImportService } from './comic-archive-import.service'

/**
 * 漫画压缩包导入 worker。
 * 负责消费已确认的 pending 任务，并清理过期或已完成的临时任务目录。
 */
@Injectable()
export class ComicArchiveImportWorker {
  constructor(
    private readonly comicArchiveImportService: ComicArchiveImportService,
  ) {}

  @Cron('*/5 * * * * *')
  async consumePendingTasks() {
    await this.comicArchiveImportService.consumePendingTasks()
  }
}
