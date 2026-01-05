interface IForumSectionData {
  name: string
  description: string
  sortOrder: number
  isEnabled: boolean
  level?: number
  path?: string
  inheritPermission?: boolean
  icon?: string
  topicReviewPolicy?: number
  userLevelRuleId?: number | null
  remark?: string
}

export async function createInitialForumSections(prisma: any) {
  const INITIAL_FORUM_SECTIONS: IForumSectionData[] = [
    {
      name: '技术交流',
      description: '讨论各种技术问题和解决方案',
      sortOrder: 1,
      isEnabled: true,
      level: 0,
      path: '/1',
      inheritPermission: true,
      topicReviewPolicy: 1,
    },
    {
      name: '经验分享',
      description: '分享项目经验和心得体会',
      sortOrder: 2,
      isEnabled: true,
      level: 0,
      path: '/2',
      inheritPermission: true,
      topicReviewPolicy: 1,
    },
    {
      name: '问答专区',
      description: '提问和回答问题的地方',
      sortOrder: 3,
      isEnabled: true,
      level: 0,
      path: '/3',
      inheritPermission: true,
      topicReviewPolicy: 1,
    },
    {
      name: '活动公告',
      description: '官方活动通知和公告发布',
      sortOrder: 4,
      isEnabled: true,
      level: 0,
      path: '/4',
      inheritPermission: true,
      topicReviewPolicy: 2,
    },
    {
      name: '建议反馈',
      description: '产品建议和用户反馈收集',
      sortOrder: 5,
      isEnabled: true,
      level: 0,
      path: '/5',
      inheritPermission: true,
      topicReviewPolicy: 1,
    },
    {
      name: '前端开发',
      description: '前端技术讨论与分享',
      sortOrder: 1,
      isEnabled: true,
      level: 1,
      path: '/1/6',
      inheritPermission: true,
      topicReviewPolicy: 1,
    },
    {
      name: '后端开发',
      description: '后端技术讨论与分享',
      sortOrder: 2,
      isEnabled: true,
      level: 1,
      path: '/1/7',
      inheritPermission: true,
      topicReviewPolicy: 1,
    },
    {
      name: '数据库',
      description: '数据库相关技术讨论',
      sortOrder: 3,
      isEnabled: true,
      level: 1,
      path: '/1/8',
      inheritPermission: true,
      topicReviewPolicy: 1,
    },
  ]

  for (const sectionData of INITIAL_FORUM_SECTIONS) {
    const existingSection = await prisma.forumSection.findFirst({
      where: { name: sectionData.name },
    })

    if (!existingSection) {
      await prisma.forumSection.create({
        data: sectionData,
      })
    }
  }
}
