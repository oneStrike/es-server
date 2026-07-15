import type { MessageChatUploadRuntimeModuleRegisterOptions } from './chat-upload-runtime.module.type'
import { SystemConfigModule } from '@libs/config/system-config/system-config.module'
import { DynamicModule, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MessageChatUploadService } from './chat-upload.service'

/** 聊天媒体上传的应用绑定点，消费根级唯一 UploadService。 */
@Module({})
export class MessageChatUploadRuntimeModule {
  static register(
    options: MessageChatUploadRuntimeModuleRegisterOptions,
  ): DynamicModule {
    return {
      module: MessageChatUploadRuntimeModule,
      imports: [ConfigModule, SystemConfigModule, options.uploadRuntimeModule],
      providers: [MessageChatUploadService],
      exports: [MessageChatUploadService],
    }
  }
}
