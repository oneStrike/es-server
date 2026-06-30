import type { DynamicModule } from '@nestjs/common'
import type { SmsModuleOptions } from './sms.type'
import { Module } from '@nestjs/common'
import { SmsService } from './sms.service'

@Module({})
export class SmsModule {
  static register(options: SmsModuleOptions = {}): DynamicModule {
    return {
      module: SmsModule,
      imports: options.imports ?? [],
      providers: [SmsService, ...(options.providers ?? [])],
      exports: [SmsService],
    }
  }
}
