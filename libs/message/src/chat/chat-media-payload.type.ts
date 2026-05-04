import type { JsonObject } from '@libs/platform/utils'
import type {
  ImageChatMessagePayloadDto,
  VideoChatMessagePayloadDto,
  VoiceChatMessagePayloadDto,
} from './dto/chat.dto'

/** 图片消息载荷；字段形状由对外 DTO 负责，内部链路只复用该稳定 contract。 */
export type ImageChatMessagePayload = ImageChatMessagePayloadDto

/** 语音消息载荷；字段形状由对外 DTO 负责，内部链路只复用该稳定 contract。 */
export type VoiceChatMessagePayload = VoiceChatMessagePayloadDto

/** 视频消息载荷；字段形状由对外 DTO 负责，内部链路只复用该稳定 contract。 */
export type VideoChatMessagePayload = VideoChatMessagePayloadDto

/** 媒体消息载荷联合；仅用于已通过聊天发送边界校验后的内部链路。 */
export type ChatMediaMessagePayload =
  | ImageChatMessagePayload
  | VoiceChatMessagePayload
  | VideoChatMessagePayload

/** 文本消息可选结构化载荷；顶层必须是普通 JSON 对象。 */
export type ChatTextMessagePayload = JsonObject | undefined

/** 客户端发送路径允许的聊天载荷联合。 */
export type ChatSendMessagePayload =
  | ChatTextMessagePayload
  | ChatMediaMessagePayload

/** 读取/推送路径允许的聊天载荷联合，系统消息保留普通 JSON 对象兜底。 */
export type ChatMessageOutputPayload = ChatMediaMessagePayload | JsonObject
