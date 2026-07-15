import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { WorkCategoryService } from './category.service'

/**
 * 分类管理模块 Lib
 */
@Module({
  imports: [DrizzleModule],
  providers: [WorkCategoryService],
  exports: [WorkCategoryService],
})
export class WorkCategoryModule {}
