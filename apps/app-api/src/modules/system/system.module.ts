import { AppConfigModule } from '@libs/app-config'
import { AgreementModule } from '@libs/app-content/agreement'
import { AppAnnouncementModule } from '@libs/app-content/announcement'
import { AppPageModule } from '@libs/app-content/page'
import { Module } from '@nestjs/common'
import { SystemController } from './system.controller'

/**
 * 系统模块
 * 整合APP配置、页面配置、公告、协议等公共功能
 */
@Module({
  imports: [
    AppPageModule,
    AgreementModule,
    AppAnnouncementModule,
    AppConfigModule,
    AppPageModule,
  ],
  controllers: [SystemController],
  providers: [],
  exports: [],
})
export class SystemModule {}
