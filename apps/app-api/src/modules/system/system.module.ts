import {
  AgreementModule,
  AppAnnouncementModule,
  AppPageModule,
} from '@libs/app-content'
import { AppConfigModule } from '@libs/app-config'
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
