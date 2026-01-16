import { LibAppPageModule } from '@libs/app-config/page'
import { Module } from '@nestjs/common'
import { AppPageController } from './page.controller'

@Module({
  imports: [LibAppPageModule],
  controllers: [AppPageController],
  providers: [],
  exports: [],
})
export class AppPageModule {}
