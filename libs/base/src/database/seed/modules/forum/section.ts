interface IForumSectionData {
  name: string
  description: string
  sortOrder: number
  isEnabled: boolean
  groupId?: number | null
  icon?: string
  topicReviewPolicy?: number
  userLevelRuleId?: number | null
  remark?: string
  topicCount?: number
  replyCount?: number
}

export async function createInitialForumSections(prisma: any) {
  const INITIAL_FORUM_SECTIONS: IForumSectionData[] = [
    {
      name: '前端开发',
      description: '前端技术讨论与分享',
      sortOrder: 1,
      isEnabled: true,
      topicReviewPolicy: 1,
      topicCount: 0,
      replyCount: 0,
    },
    {
      name: '后端开发',
      description: '后端技术讨论与分享',
      sortOrder: 2,
      isEnabled: true,
      topicReviewPolicy: 1,
      topicCount: 0,
      replyCount: 0,
    },
    {
      name: '数据库',
      description: '数据库相关技术讨论',
      sortOrder: 3,
      isEnabled: true,
      topicReviewPolicy: 1,
      topicCount: 0,
      replyCount: 0,
    },
  ]

  for (const sectionData of INITIAL_FORUM_SECTIONS) {
    const existingSection = await prisma.forumSection.findFirst({
      where: { name: sectionData.name },
    })

    if (!existingSection) {
      const groupName = '技术交流'
      const group = await prisma.forumSectionGroup.findFirst({
        where: { name: groupName },
      })

      await prisma.forumSection.create({
        data: {
          name: sectionData.name,
          description: sectionData.description,
          sortOrder: sectionData.sortOrder,
          isEnabled: sectionData.isEnabled,
          groupId: group?.id || null,
          icon: sectionData.icon,
          topicReviewPolicy: sectionData.topicReviewPolicy || 1,
          userLevelRuleId: sectionData.userLevelRuleId,
          remark: sectionData.remark,
          topicCount: sectionData.topicCount || 0,
          replyCount: sectionData.replyCount || 0,
        },
      })
    }
  }
}
