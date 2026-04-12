import { AppConfigModule } from '@libs/app-config/config.module';
import { AgreementModule } from '@libs/app-content/agreement/agreement.module';
import { AppAnnouncementModule } from '@libs/app-content/announcement/announcement.module';
import { AppPageModule } from '@libs/app-content/page/page.module';
import { AppUpdateModule } from '@libs/app-content/update/update.module';
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
    AppUpdateModule,
    AppPageModule,
  ],
  controllers: [SystemController],
  providers: [],
  exports: [],
})
export class SystemModule {}
