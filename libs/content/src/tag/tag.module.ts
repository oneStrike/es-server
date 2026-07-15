import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { WorkTagService } from './tag.service'

/**
 * 标签管理模块 Lib
 */
@Module({
  imports: [DrizzleModule],
  providers: [WorkTagService],
  exports: [WorkTagService],
})
export class WorkTagModule {}
