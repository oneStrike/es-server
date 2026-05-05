import type { UploadConfigInterface } from '@libs/platform/config'
import type {
  UploadConfigProvider,
  UploadProviderResolutionContext,
  UploadResult,
} from '@libs/platform/modules/upload/upload.type'
import type { FastifyRequest } from 'fastify'
import type { ChatMediaFileCategory } from './chat-media-origin-policy.type'
import { UploadService } from '@libs/platform/modules/upload/upload.service'
import {
  UPLOAD_CONFIG_PROVIDER,
  UploadProviderEnum,
} from '@libs/platform/modules/upload/upload.type'
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { buildChatMediaOriginPolicy } from './chat-media-origin-policy'

const CHAT_UPLOAD_SCENE = 'chat'
const CHAT_UPLOAD_FILE_CATEGORIES = ['image', 'audio', 'video'] as const

/** 聊天媒体上传编排，隔离聊天业务的 provider 兼容策略。 */
@Injectable()
export class MessageChatUploadService {
  private readonly uploadConfig: UploadConfigInterface

  // 初始化聊天上传所需的通用上传服务与运行时上传配置。
  constructor(
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(UPLOAD_CONFIG_PROVIDER)
    private readonly uploadConfigProvider?: UploadConfigProvider,
  ) {
    this.uploadConfig = this.configService.get<UploadConfigInterface>('upload')!
  }

  // 上传聊天媒体文件，并强制使用聊天 scene 与媒体分类白名单。
  async uploadMedia(req: FastifyRequest): Promise<UploadResult> {
    const result = await this.uploadService.uploadFile(req, undefined, {
      sceneOverride: CHAT_UPLOAD_SCENE,
      allowedFileCategories: CHAT_UPLOAD_FILE_CATEGORIES,
      resolveProvider: (context) => this.resolveChatProvider(context),
    })

    this.assertChatMediaResult(result)
    return result
  }

  // Superbed 返回外部图床 URL，不进入 chat.send 媒体来源白名单，聊天入口预先回退本地。
  private resolveChatProvider(context: UploadProviderResolutionContext) {
    if (context.configuredProvider === UploadProviderEnum.SUPERBED) {
      return UploadProviderEnum.LOCAL
    }

    return undefined
  }

  // 校验上传结果仍可被聊天消息发送边界接受。
  private assertChatMediaResult(result: UploadResult) {
    const fileCategory = this.toChatMediaFileCategory(result.fileCategory)
    if (
      result.scene !== CHAT_UPLOAD_SCENE ||
      !fileCategory ||
      !this.createMediaOriginPolicy().accepts(result.filePath, fileCategory)
    ) {
      throw new InternalServerErrorException('聊天媒体文件来源无效')
    }
  }

  // 基于当前系统上传配置构造聊天媒体来源策略。
  private createMediaOriginPolicy() {
    return buildChatMediaOriginPolicy({
      uploadConfig: this.uploadConfig,
      systemUploadConfig: this.uploadConfigProvider?.getUploadConfig(),
    })
  }

  // 将通用上传分类收敛为聊天允许的媒体分类。
  private toChatMediaFileCategory(
    fileCategory: UploadResult['fileCategory'],
  ): ChatMediaFileCategory | null {
    return CHAT_UPLOAD_FILE_CATEGORIES.includes(
      fileCategory as ChatMediaFileCategory,
    )
      ? (fileCategory as ChatMediaFileCategory)
      : null
  }
}
