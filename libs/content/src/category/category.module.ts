import { Module } from '@nestjs/common'
import { WorkCategoryService } from './category.service'

/**
 * 分类管理模块 Lib
 */
@Module({
  providers: [WorkCategoryService],
  exports: [WorkCategoryService],
})
export class WorkCategoryModule {}
