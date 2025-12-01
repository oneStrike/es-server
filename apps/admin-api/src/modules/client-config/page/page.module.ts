import { ClientPageModule } from '@libs/client-config/page'
import { Module } from '@nestjs/common'
import { ClientPageController } from './page.controller'

/**
 * 客户端页面配置模块
 * 提供页面配置相关的功能模块
 */
@Module({
  imports: [ClientPageModule],
  controllers: [ClientPageController],
  providers: [],
  exports: [], // 导出服务供其他模块使用
})
export class AdminClientPageModule {}
