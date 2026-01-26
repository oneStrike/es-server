import { Module } from '@nestjs/common'
import { WorkAuthorService } from './author.service'

/**
 * 作者管理模块
 * 提供作者相关的功能模块
 */
@Module({
  providers: [WorkAuthorService],
  exports: [WorkAuthorService],
})
export class WorkAuthorModule {}
