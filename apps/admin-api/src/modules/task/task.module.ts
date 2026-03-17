import { TaskModule as LibTaskModule } from '@libs/growth'
import { Module } from '@nestjs/common'
import { TaskController } from './task.controller'

@Module({
  imports: [LibTaskModule],
  controllers: [TaskController],
})
export class TaskModule {}
