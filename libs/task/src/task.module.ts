import { DrizzleModule } from '@db/drizzle.module'
import { UserGrowthRewardModule } from '@libs/user'
import { Module } from '@nestjs/common'
import { TaskService } from './task.service'

@Module({
  imports: [DrizzleModule, UserGrowthRewardModule],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
