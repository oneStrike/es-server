import type { PrismaClient } from '@prisma/client'

export async function createInitialForumConfig(prisma: PrismaClient) {
  const existingConfig = await prisma.forumConfig.findFirst()
  if (existingConfig) {
    console.log('论坛配置已存在，跳过填充')
    return existingConfig
  }

  const forumConfig = await prisma.forumConfig.create({
    data: {
      siteName: '我的社区',
      siteDescription: '一个优秀的社区论坛',
      siteKeywords: '社区,论坛,交流',
      contactEmail: 'contact@example.com',
      topicTitleMaxLength: 200,
      topicContentMaxLength: 10000,
      replyContentMaxLength: 5000,
      reviewPolicy: 1,
      allowAnonymousView: true,
      allowAnonymousPost: false,
      allowAnonymousReply: false,
      allowUserRegister: true,
      registerRequireEmailVerify: true,
      registerRequirePhoneVerify: false,
      usernameMinLength: 3,
      usernameMaxLength: 20,
      signatureMaxLength: 200,
      bioMaxLength: 500,
      defaultPointsForNewUser: 100,
      enableEmailNotification: true,
      enableInAppNotification: true,
      enableNewTopicNotification: true,
      enableNewReplyNotification: true,
      enableLikeNotification: true,
      enableFavoriteNotification: true,
      enableSystemNotification: true,
      enableMaintenanceMode: false,
      maintenanceMessage: '系统维护中，请稍后再来',
    },
  })

  console.log('论坛配置填充成功:', forumConfig.id)
  return forumConfig
}
