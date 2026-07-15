import { MessageChatUploadRuntimeModule } from '@libs/message/chat/chat-upload-runtime.module'
import { Module } from '@nestjs/common'
import { UploadModule } from '../system/upload/upload.module'

/** App API 聊天媒体上传运行时组合，复用根级唯一通用上传装配。 */
@Module({
  imports: [
    MessageChatUploadRuntimeModule.register({
      uploadRuntimeModule: UploadModule,
    }),
  ],
  exports: [MessageChatUploadRuntimeModule],
})
export class AppMessageChatUploadRuntimeModule {}
