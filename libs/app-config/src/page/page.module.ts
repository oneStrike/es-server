import { Module } from '@nestjs/common'
import { LibAppPageService } from './page.service'

@Module({
  providers: [LibAppPageService],
  exports: [LibAppPageService],
})
export class LibAppPageModule {}
