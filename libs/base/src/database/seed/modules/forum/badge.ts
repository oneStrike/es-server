interface IForumBadgeData {
  name: string
  description: string
  icon: string
  type: number
  order: number
  isEnabled: boolean
}

export async function createInitialForumBadges(prisma: any) {
  const INITIAL_FORUM_BADGES: IForumBadgeData[] = [
    {
      name: '新手入门',
      description: '完成首次发帖',
      icon: '🌱',
      type: 2,
      order: 1,
      isEnabled: true,
    },
    {
      name: '活跃用户',
      description: '发布超过10个主题',
      icon: '🏆',
      type: 2,
      order: 2,
      isEnabled: true,
    },
    {
      name: '热心回答',
      description: '回复超过50个问题',
      icon: '❤️',
      type: 2,
      order: 3,
      isEnabled: true,
    },
    {
      name: '技术专家',
      description: '获得超过100个赞',
      icon: '⭐',
      type: 2,
      order: 4,
      isEnabled: true,
    },
    {
      name: '社区贡献者',
      description: '获得超过500个赞',
      icon: '👑',
      type: 2,
      order: 5,
      isEnabled: true,
    },
    {
      name: '版主认证',
      description: '认证版主徽章',
      icon: '🛡️',
      type: 1,
      order: 6,
      isEnabled: true,
    },
  ]

  for (const badgeData of INITIAL_FORUM_BADGES) {
    const existingBadge = await prisma.forumBadge.findFirst({
      where: { name: badgeData.name },
    })

    if (!existingBadge) {
      await prisma.forumBadge.create({
        data: {
          name: badgeData.name,
          description: badgeData.description,
          icon: badgeData.icon,
          type: badgeData.type,
          sortOrder: badgeData.order,
          isEnabled: badgeData.isEnabled,
        },
      })
    }
  }
}
