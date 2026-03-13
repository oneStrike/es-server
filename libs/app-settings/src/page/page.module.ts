import { Module } from '@nestjs/common'
import { AppPageService } from './page.service'

@Module({
  providers: [AppPageService],
  exports: [AppPageService],
})
export class AppPageModule {}
