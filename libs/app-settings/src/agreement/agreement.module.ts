import { Module } from '@nestjs/common'

import { AgreementService } from './agreement.service'

@Module({
  providers: [AgreementService],
  exports: [AgreementService],
})
export class AgreementModule {}
