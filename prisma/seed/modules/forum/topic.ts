interface ITopicTemplate {
  title: string
  content: string
}

const TOPIC_TEMPLATES: ITopicTemplate[] = [
  {
    title: '剧情讨论与感受分享',
    content:
      '欢迎在这里讨论这部作品的剧情、节奏与伏笔，也可以分享你的高光章节与追更感受。',
  },
  {
    title: '角色分析与人物关系',
    content:
      '欢迎聊聊角色成长、人物弧线、角色关系与名场面，理性讨论，友善交流。',
  },
]

export async function createInitialForumTopics(prisma: any) {
  const user = await prisma.appUser.findFirst({
    where: { phone: '13800138000', deletedAt: null },
    select: { id: true },
  })

  if (!user) {
    return
  }

  const works = await prisma.work.findMany({
    where: {
      deletedAt: null,
      forumSectionId: { not: null },
    },
    select: {
      name: true,
      forumSectionId: true,
    },
    orderBy: { id: 'asc' },
    take: 8,
  })

  if (!works.length) {
    return
  }

  const touchedSectionIds = new Set<number>()

  for (const work of works) {
    if (!work.forumSectionId) {
      continue
    }

    touchedSectionIds.add(work.forumSectionId)

    for (const template of TOPIC_TEMPLATES) {
      const title = `${work.name}｜${template.title}`
      const exists = await prisma.forumTopic.findFirst({
        where: {
          sectionId: work.forumSectionId,
          title,
          deletedAt: null,
        },
        select: { id: true },
      })

      if (exists) {
        continue
      }

      await prisma.forumTopic.create({
        data: {
          sectionId: work.forumSectionId,
          userId: user.id,
          title,
          content: `${work.name}\n\n${template.content}`,
          auditStatus: 1,
        },
      })
    }
  }

  for (const sectionId of touchedSectionIds) {
    const topicStats = await prisma.forumTopic.aggregate({
      where: {
        sectionId,
        deletedAt: null,
      },
      _count: { id: true },
      _sum: { replyCount: true },
      _max: { createdAt: true, lastReplyAt: true },
    })

    await prisma.forumSection.update({
      where: { id: sectionId },
      data: {
        topicCount: topicStats._count.id,
        replyCount: topicStats._sum.replyCount ?? 0,
        lastPostAt: topicStats._max.lastReplyAt ?? topicStats._max.createdAt,
      },
    })
  }

  const userTopicStats = await prisma.forumTopic.aggregate({
    where: {
      userId: user.id,
      deletedAt: null,
    },
    _count: { id: true },
  })

  await prisma.forumProfile.updateMany({
    where: { userId: user.id, deletedAt: null },
    data: {
      topicCount: userTopicStats._count.id,
    },
  })
}
