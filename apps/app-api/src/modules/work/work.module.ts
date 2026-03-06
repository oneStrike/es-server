import { WorkModule as WorkCoreModule } from '@libs/content/work/core'
import { Module } from '@nestjs/common'
import { WorkChapterController } from './work-chapter.controller'
import { WorkDownloadController } from './work-download.controller'
import { WorkPurchaseController } from './work-purchase.controller'
import { WorkController } from './work.controller'

@Module({
  imports: [WorkCoreModule],
  controllers: [
    WorkController,
    WorkChapterController,
    WorkPurchaseController,
    WorkDownloadController,
  ],
})
export class WorkModule {}
