import { AgreementModule as LibAgreementModule } from '@libs/app-content/agreement/agreement.module';
import { Module } from '@nestjs/common'
import { AgreementController } from './agreement.controller'

@Module({
  imports: [LibAgreementModule],
  controllers: [AgreementController],
})
export class AgreementModule {}
