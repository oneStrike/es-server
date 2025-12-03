import { Module } from '@nestjs/common'
import { ContentTypeController } from './content-type.controller'
import { ContentTypeService } from './content-type.service'

/**
 * 内容类型管理模块
 */
@Module({
  controllers: [ContentTypeController],
  providers: [ContentTypeService],
  exports: [ContentTypeService],
})
export class ContentTypeModule {}
