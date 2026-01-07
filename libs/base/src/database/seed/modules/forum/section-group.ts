interface IForumSectionGroupData {
  name: string
  description: string
  sortOrder: number
  isEnabled: boolean
  icon?: string
}

export async function createInitialForumSectionGroups(prisma: any) {
  const INITIAL_FORUM_SECTION_GROUPS: IForumSectionGroupData[] = [
    {
      name: '技术交流',
      description: '讨论各种技术问题和解决方案',
      sortOrder: 1,
      isEnabled: true,
    },
    {
      name: '经验分享',
      description: '分享项目经验和心得体会',
      sortOrder: 2,
      isEnabled: true,
    },
    {
      name: '问答专区',
      description: '提问和回答问题的地方',
      sortOrder: 3,
      isEnabled: true,
    },
    {
      name: '活动公告',
      description: '官方活动通知和公告发布',
      sortOrder: 4,
      isEnabled: true,
    },
    {
      name: '建议反馈',
      description: '产品建议和用户反馈收集',
      sortOrder: 5,
      isEnabled: true,
    },
  ]

  for (const groupData of INITIAL_FORUM_SECTION_GROUPS) {
    const existingGroup = await prisma.forumSectionGroup.findFirst({
      where: { name: groupData.name },
    })

    if (!existingGroup) {
      await prisma.forumSectionGroup.create({
        data: groupData,
      })
    }
  }
}
