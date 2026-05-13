import { BackgroundTaskModule } from '@libs/platform/modules/background-task/background-task.module'
import { Module } from '@nestjs/common'
import { AdminBackgroundTaskController } from './background-task.controller'

@Module({
  imports: [BackgroundTaskModule],
  controllers: [AdminBackgroundTaskController],
})
export class AdminBackgroundTaskModule {}
