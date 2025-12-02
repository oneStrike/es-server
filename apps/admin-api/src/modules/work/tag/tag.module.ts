import { Module } from '@nestjs/common'
import { WorkTagController } from './tag.controller'
import { WorkTagService } from './tag.service'

/**
 * 标签管理模块
 * 提供标签相关的业务逻辑和API接口
 */
@Module({
  controllers: [WorkTagController],
  providers: [WorkTagService],
  exports: [WorkTagService],
})
export class WorkTagModule {}
