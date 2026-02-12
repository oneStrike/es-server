interface IForumPointRuleData {
  name: string
  description: string
  type: number
  points: number
  dailyLimit?: number
  isEnabled: boolean
  business?: string
  eventKey?: string | null
}

export async function createInitialForumPointRules(prisma: any) {
  const INITIAL_FORUM_POINT_RULES: IForumPointRuleData[] = [
    {
      name: '每日登录',
      description: '每日登录奖励',
      type: 6,
      points: 5,
      dailyLimit: 1,
      isEnabled: true,
      business: 'forum',
      eventKey: null,
    },
    {
      name: '发布主题',
      description: '发布新主题奖励',
      type: 1,
      points: 10,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.topic.create',
    },
    {
      name: '发布回复',
      description: '发布新回复奖励',
      type: 2,
      points: 5,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.reply.create',
    },
    {
      name: '主题被点赞',
      description: '主题被点赞奖励',
      type: 3,
      points: 2,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.topic.like',
    },
    {
      name: '回复被点赞',
      description: '回复被点赞奖励',
      type: 4,
      points: 2,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.reply.like',
    },
    {
      name: '主题被收藏',
      description: '主题被收藏奖励',
      type: 5,
      points: 3,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.topic.favorite',
    },
    {
      name: '主题浏览',
      description: '浏览主题奖励',
      type: 8,
      points: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.topic.view',
    },
    {
      name: '举报内容',
      description: '举报内容奖励',
      type: 9,
      points: 2,
      dailyLimit: 5,
      isEnabled: false,
      business: 'forum',
      eventKey: 'forum.report.create',
    },
  ]

  for (const ruleData of INITIAL_FORUM_POINT_RULES) {
    const existingRule = await prisma.userPointRule.findFirst({
      where: { type: ruleData.type },
    })

    if (!existingRule) {
      await prisma.userPointRule.create({
        data: {
          name: ruleData.name,
          type: ruleData.type,
          points: ruleData.points,
          dailyLimit: ruleData.dailyLimit || 0,
          isEnabled: ruleData.isEnabled,
          remark: ruleData.description,
          business: ruleData.business,
          eventKey: ruleData.eventKey ?? undefined,
        },
      })
    }
  }
}
