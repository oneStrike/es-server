interface IForumBadgeData {
  name: string
  description: string
  icon: string
  type: number
  sortOrder: number
  isEnabled: boolean
  business?: string
  eventKey?: string | null
}

export async function createInitialForumBadges(prisma: any) {
  const INITIAL_FORUM_BADGES: IForumBadgeData[] = [
    {
      name: '新手入门',
      description: '完成首次发帖',
      icon: '🌱',
      type: 2,
      sortOrder: 1,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.topic.create',
    },
    {
      name: '活跃用户',
      description: '发布超过10个主题',
      icon: '🏆',
      type: 2,
      sortOrder: 2,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.topic.create',
    },
    {
      name: '热心回答',
      description: '回复超过50个问题',
      icon: '❤️',
      type: 2,
      sortOrder: 3,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.reply.create',
    },
    {
      name: '技术专家',
      description: '获得超过100个赞',
      icon: '⭐',
      type: 2,
      sortOrder: 4,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.topic.like',
    },
    {
      name: '社区贡献者',
      description: '获得超过500个赞',
      icon: '👑',
      type: 2,
      sortOrder: 5,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.topic.like',
    },
    {
      name: '版主认证',
      description: '认证版主徽章',
      icon: '🛡️',
      type: 1,
      sortOrder: 6,
      isEnabled: true,
      business: 'forum',
      eventKey: null,
    },
  ]

  for (const badgeData of INITIAL_FORUM_BADGES) {
    const existingBadge = await prisma.userBadge.findFirst({
      where: { name: badgeData.name },
    })

    if (!existingBadge) {
      await prisma.userBadge.create({
        data: {
          name: badgeData.name,
          description: badgeData.description,
          icon: badgeData.icon,
          type: badgeData.type,
          sortOrder: badgeData.sortOrder,
          isEnabled: badgeData.isEnabled,
          business: badgeData.business,
          eventKey: badgeData.eventKey ?? undefined,
        },
      })
    }
  }
}
