import { AppPageModule as AppPageModuleLib } from '@libs/app-settings'
import { Module } from '@nestjs/common'
import { AppPageController } from './page.controller'

@Module({
  imports: [AppPageModuleLib],
  controllers: [AppPageController],
  providers: [],
  exports: [],
})
export class AppPageModule {}
