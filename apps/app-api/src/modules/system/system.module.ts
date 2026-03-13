import {
  AgreementModule,
  AppAnnouncementModule,
  AppConfigModule,
  AppPageModule,
} from '@libs/app-settings'
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
