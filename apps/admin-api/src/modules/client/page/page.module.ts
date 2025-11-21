import { Module } from '@nestjs/common'
import { ClientPageController } from './page.controller'
import { ClientPageService } from './page.service'

/**
 * 客户端页面配置模块
 * 提供页面配置相关的功能模块
 */
@Module({
  controllers: [ClientPageController],
  providers: [ClientPageService],
  exports: [ClientPageService], // 导出服务供其他模块使用
})
export class ClientPageModule {}
