import { WorkModule as WorkCoreModule } from '@libs/content/work/core'
import { Module } from '@nestjs/common'
import { WorkController } from './work.controller'

@Module({
  imports: [WorkCoreModule],
  controllers: [WorkController],
  providers: [],
  exports: [],
})
export class WorkModule {}
