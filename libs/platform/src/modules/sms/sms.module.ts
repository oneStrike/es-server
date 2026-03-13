import type { DynamicModule, Provider, Type } from '@nestjs/common'
import { Module } from '@nestjs/common'
import { SmsService } from './sms.service'

/**
 * 阿里云短信模块
 * 提供短信发送、验证码发送等功能
 */
export interface SmsModuleOptions {
  imports?: Array<DynamicModule | Type<any>>
  providers?: Provider[]
}

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
