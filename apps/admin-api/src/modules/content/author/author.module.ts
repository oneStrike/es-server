import { WorkAuthorModule as WorkAuthorModuleLib } from '@libs/content/author'
import { Module } from '@nestjs/common'
import { ContentAuthorController } from './author.controller'

/**
 * 作者管理模块
 * 提供作者相关的功能模块
 */
@Module({
  imports: [WorkAuthorModuleLib],
  controllers: [ContentAuthorController],
  providers: [],
  exports: [WorkAuthorModuleLib], // 导出服务供其他模块使用
})
export class ContentAuthorModule {}
