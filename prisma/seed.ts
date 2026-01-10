import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始填充论坛配置默认数据...')

  const existingConfig = await prisma.forumConfig.findFirst()
  if (existingConfig) {
    console.log('论坛配置已存在，跳过填充')
    return
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
      topicReviewPolicy: 1,
      replyReviewPolicy: 1,
      allowAnonymousView: true,
      allowAnonymousPost: false,
      allowAnonymousReply: false,
      newUserPostLimitHours: 24,
      dailyPostLimit: 50,
      dailyReplyLimit: 100,
      allowUserRegister: true,
      registerRequireEmailVerify: true,
      registerRequirePhoneVerify: false,
      usernameMinLength: 3,
      usernameMaxLength: 20,
      passwordMinLength: 8,
      passwordRequireNumber: true,
      passwordRequireUppercase: false,
      passwordRequireSpecialChar: false,
      signatureMaxLength: 200,
      bioMaxLength: 500,
      postTopicPoints: 10,
      postReplyPoints: 5,
      topicLikedPoints: 2,
      replyLikedPoints: 1,
      topicFavoritedPoints: 3,
      dailyCheckInPoints: 5,
      deleteTopicPoints: -10,
      deleteReplyPoints: -5,
      enableEmailNotification: true,
      enableInAppNotification: true,
      enableNewTopicNotification: true,
      enableNewReplyNotification: true,
      enableLikeNotification: true,
      enableFavoriteNotification: true,
      enableSystemNotification: true,
      enableCaptcha: true,
      captchaType: 1,
      loginFailLockCount: 5,
      loginFailLockMinutes: 30,
      ipRateLimitPerMinute: 60,
      enableSensitiveWordFilter: true,
      sensitiveWordReplaceChar: '*',
      enableMaintenanceMode: false,
      maintenanceMessage: '系统维护中，请稍后再来',
      enableStatistics: true,
      statisticsRetentionDays: 90,
      enableSearch: true,
      searchPageSize: 20,
      enableTags: true,
      maxTagsPerTopic: 5,
    },
  })

  console.log('论坛配置填充成功:', forumConfig.id)
}

main()
  .catch((e) => {
    console.error('填充失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
