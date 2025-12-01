import { LibsClientNoticeModule } from '@libs/client-config/notice'
import { Module } from '@nestjs/common'
import { ClientNoticeController } from './notice.controller'

/**
 * 客户端通知模块
 * 提供通知相关的功能模块
 */
@Module({
  imports: [LibsClientNoticeModule],
  controllers: [ClientNoticeController],
  providers: [],
  exports: [], // 导出服务供其他模块使用
})
export class ClientNoticeModule {}
