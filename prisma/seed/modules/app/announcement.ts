export async function createInitialAppAnnouncement(prisma: any) {
  // Fetch page IDs
  const homePage = await prisma.appPage.findFirst({ where: { code: 'home' } })
  const vipPage = await prisma.appPage.findFirst({ where: { code: 'vip_center' } })

  // Use fallback ID 1 if page not found (though it should exist due to seed order)
  const homePageId = homePage?.id || 1
  const vipPageId = vipPage?.id || 1

  const initData = [
    {
      title: '欢迎使用漫画阅读平台',
      content:
        '欢迎来到我们的漫画阅读平台！这里有丰富的漫画资源，优质的阅读体验。请遵守平台规则，享受愉快的阅读时光。',
      summary: '欢迎来到漫画阅读平台，请遵守平台规则',
      announcementType: 0, // 平台公告
      priorityLevel: 1,
      publishStartTime: new Date('2024-01-01T00:00:00Z'),
      publishEndTime: new Date('2025-12-31T23:59:59Z'),
      pageId: homePageId,
      isPublished: true,
      enablePlatform: [1],
      isPinned: true,
      showAsPopup: false,
    },
    {
      title: '平台功能更新公告',
      content:
        '我们持续优化平台功能，提升用户体验。最新版本增加了书签功能、阅读历史记录、个性化推荐等特性。感谢您的支持！',
      summary: '新增书签、阅读历史、个性化推荐等功能',
      announcementType: 3, // 更新公告
      priorityLevel: 2,
      publishStartTime: new Date('2024-01-01T00:00:00Z'),
      publishEndTime: new Date('2024-12-31T23:59:59Z'),
      pageId: homePageId,
      isPublished: true,
      enablePlatform: [1],
      isPinned: false,
      showAsPopup: true,
    },
    {
      title: '用户行为规范提醒',
      content:
        '为了维护良好的社区环境，请用户遵守以下规范：\n1. 不发布违法违规内容\n2. 尊重他人，文明交流\n3. 不恶意刷屏或灌水\n4. 保护个人隐私信息\n违反规范的用户将面临相应处罚。',
      summary: '请遵守社区规范，共建良好环境',
      announcementType: 4, // 政策公告
      priorityLevel: 1,
      publishStartTime: new Date('2024-01-01T00:00:00Z'),
      publishEndTime: new Date('2025-12-31T23:59:59Z'),
      pageId: homePageId,
      isPublished: true,
      enablePlatform: [1],
      isPinned: false,
      showAsPopup: false,
    },
    {
      title: 'VIP会员权益介绍',
      content:
        'VIP会员享有以下专属权益：\n1. 无广告阅读体验\n2. 提前阅读最新章节\n3. 高清画质支持\n4. 专属客服服务\n5. 会员专区内容访问\n立即升级VIP，享受更优质的服务！',
      summary: 'VIP会员专享无广告、抢先看、高清画质等权益',
      announcementType: 1, // 活动公告
      priorityLevel: 2,
      publishStartTime: new Date('2024-01-01T00:00:00Z'),
      publishEndTime: new Date('2024-12-31T23:59:59Z'),
      pageId: vipPageId,
      isPublished: true,
      enablePlatform: [1],
      isPinned: false,
      showAsPopup: false,
    },
    {
      title: '系统维护通知',
      content:
        '为了提供更好的服务，我们将在每周三凌晨2:00-4:00进行系统维护。维护期间可能会影响部分功能的正常使用，请您谅解。',
      summary: '每周三凌晨2:00-4:00系统维护',
      announcementType: 2, // 维护公告
      priorityLevel: 1,
      publishStartTime: new Date('2024-01-01T00:00:00Z'),
      publishEndTime: new Date('2025-12-31T23:59:59Z'),
      pageId: homePageId,
      isPublished: true,
      enablePlatform: [1],
      isPinned: false,
      showAsPopup: false,
    },
  ]

  for (const item of initData) {
    const existingAnnouncement = await prisma.appAnnouncement.findFirst({
      where: { title: item.title },
    })

    if (!existingAnnouncement) {
      await prisma.appAnnouncement.create({
        data: item,
      })
    }
  }
}
