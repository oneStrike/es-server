import { WorkTagModule as WorkTagModuleLib } from '@libs/content/tag'
import { Module } from '@nestjs/common'
import { WorkTagController } from './tag.controller'

/**
 * 标签管理模块
 * 提供标签相关的业务逻辑和API接口
 */
@Module({
  imports: [WorkTagModuleLib],
  controllers: [WorkTagController],
  providers: [],
  exports: [WorkTagModuleLib],
})
export class WorkTagModule {}
