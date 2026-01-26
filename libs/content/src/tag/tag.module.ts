import { Module } from '@nestjs/common'
import { WorkTagService } from './tag.service'

/**
 * 标签管理模块 Lib
 */
@Module({
  providers: [WorkTagService],
  exports: [WorkTagService],
})
export class WorkTagModule {}
