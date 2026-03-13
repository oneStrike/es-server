import { AgreementModule as LibAgreementModule } from '@libs/app-settings'
import { Module } from '@nestjs/common'

import { AgreementController } from './agreement.controller'

@Module({
  imports: [LibAgreementModule],
  controllers: [AgreementController],
})
export class AgreementModule {}
