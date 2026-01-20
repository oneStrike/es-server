import { AppConfigModule as AppConfigModuleLib } from '@libs/app-config/config'
import { Module } from '@nestjs/common'
import { AppConfigController } from './config.controller'

@Module({
  imports: [AppConfigModuleLib],
  controllers: [AppConfigController],
  providers: [],
  exports: [],
})
export class AppConfigModule { }
