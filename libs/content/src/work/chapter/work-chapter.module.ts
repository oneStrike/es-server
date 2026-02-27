import { ContentPermissionModule } from '@libs/content/permission'
import { InteractionModule } from '@libs/interaction'
import { UserBalanceModule } from '@libs/user/balance'
import { UserGrowthEventModule } from '@libs/user/growth-event'
import { UserPermissionModule } from '@libs/user/permission'
import { UserPointModule } from '@libs/user/point'
import { Module } from '@nestjs/common'
import { WorkChapterService } from './work-chapter.service'

@Module({
  imports: [
    ContentPermissionModule,
    InteractionModule,
    UserGrowthEventModule,
    UserPermissionModule,
    UserPointModule,
    UserBalanceModule,
  ],
  providers: [WorkChapterService],
  exports: [WorkChapterService],
})
export class WorkChapterModule {}
