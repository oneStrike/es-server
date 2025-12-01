import { Module } from '@nestjs/common'
import { LibClientPageService } from './page.service'

/**
 * 客户端页面配置模块
 * 提供页面配置相关的功能模块
 */
@Module({
  providers: [LibClientPageService],
  exports: [LibClientPageService], // 导出服务供其他模块使用
})
export class LibClientPageModule {}
