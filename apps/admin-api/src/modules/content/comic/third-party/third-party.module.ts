import { Module } from '@nestjs/common'
import { CopyService } from './libs/copy.service'
import { ComicThirdPartyService } from './third-party-service'
import { ComicThirdPartyController } from './third-party.controller'

@Module({
  controllers: [ComicThirdPartyController],
  providers: [ComicThirdPartyService, CopyService],
  exports: [ComicThirdPartyService],
})
export class ComicThirdPartyModule {}
