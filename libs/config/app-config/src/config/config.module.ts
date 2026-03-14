/// 应用配置模块
/// 提供应用基础配置的管理功能，包括配置的创建、查询、更新和删除
/// 模块初始化时会自动创建默认配置数据
import { Module } from '@nestjs/common'
import { AppConfigService } from './config.service'

@Module({
  controllers: [],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
