import { AgreementModule } from '@libs/app-config/agreement'
import { AppAnnouncementModule } from '@libs/app-config/announcement'
import { AppConfigModule } from '@libs/app-config/config'
import { AppPageModule } from '@libs/app-config/page'
import { Module } from '@nestjs/common'
import { SystemController } from './system.controller'

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
