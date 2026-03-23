import { WorkCategoryModule as WorkCategoryModuleLib } from '@libs/content/category'
import { Module } from '@nestjs/common'
import { ContentCategoryController } from './category.controller'

/**
 * 分类管理模块
 * 提供分类相关的功能和服务
 */
@Module({
  imports: [WorkCategoryModuleLib],
  controllers: [ContentCategoryController],
  providers: [],
  exports: [WorkCategoryModuleLib],
})
export class ContentCategoryModule {}
