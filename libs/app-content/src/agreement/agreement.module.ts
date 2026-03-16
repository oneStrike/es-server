import { Module } from '@nestjs/common'
import { AgreementService } from './agreement.service'

/**
 * 协议模块
 * 提供协议的管理功能
 */
@Module({
  imports: [],
  providers: [AgreementService],
  exports: [AgreementService],
})
export class AgreementModule {}
