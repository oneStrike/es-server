import { InteractionModule } from '@libs/interaction'
import { UserGrowthEventModule } from '@libs/user/growth-event'
import { Module } from '@nestjs/common'
import { WorkChapterService } from './work-chapter.service'

@Module({
  imports: [InteractionModule, UserGrowthEventModule],
  providers: [WorkChapterService],
  exports: [WorkChapterService],
})
export class WorkChapterModule {}
