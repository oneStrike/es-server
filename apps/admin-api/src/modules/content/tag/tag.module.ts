import { WorkTagModule as WorkTagModuleLib } from '@libs/content/tag'
import { Module } from '@nestjs/common'
import { ContentTagController } from './tag.controller'

/**
 * 标签管理模块
 * 提供标签相关的业务逻辑和API接口
 */
@Module({
  imports: [WorkTagModuleLib],
  controllers: [ContentTagController],
  providers: [],
  exports: [WorkTagModuleLib],
})
export class ContentTagModule {}
