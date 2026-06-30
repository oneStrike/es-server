/** 后台聊天排查视图中的用户简要信息，供会话与消息排查返回结构复用。 */
export interface ChatUserSummary {
  userId: number
  nickname: string | null
  avatarUrl: string | null
}
