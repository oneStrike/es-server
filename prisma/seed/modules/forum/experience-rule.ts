interface IForumExperienceRuleData {
  name: string
  description: string
  type: number
  experience: number
  dailyLimit?: number
  isEnabled: boolean
  business?: string
  eventKey?: string | null
}

export async function createInitialForumExperienceRules(prisma: any) {
  const INITIAL_FORUM_EXPERIENCE_RULES: IForumExperienceRuleData[] = [
    {
      name: '发表主题',
      description: '用户发表主题获得10点经验，每日最多获得500点经验',
      type: 1,
      experience: 10,
      dailyLimit: 50,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.topic.create',
    },
    {
      name: '发表回复',
      description: '用户发表回复获得5点经验，每日最多获得500点经验',
      type: 2,
      experience: 5,
      dailyLimit: 100,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.reply.create',
    },
    {
      name: '主题被点赞',
      description: '用户主题被点赞获得2点经验，无每日限制',
      type: 3,
      experience: 2,
      dailyLimit: 0,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.topic.like',
    },
    {
      name: '回复被点赞',
      description: '用户回复被点赞获得1点经验，无每日限制',
      type: 4,
      experience: 1,
      dailyLimit: 0,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.reply.like',
    },
    {
      name: '主题被收藏',
      description: '用户主题被收藏获得3点经验，无每日限制',
      type: 5,
      experience: 3,
      dailyLimit: 0,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.topic.favorite',
    },
    {
      name: '主题浏览',
      description: '用户浏览主题获得1点经验，每日最多50次',
      type: 8,
      experience: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.topic.view',
    },
    {
      name: '举报内容',
      description: '用户举报内容获得2点经验，每日最多5次',
      type: 9,
      experience: 2,
      dailyLimit: 5,
      isEnabled: false,
      business: 'forum',
      eventKey: 'forum.report.create',
    },
    {
      name: '每日签到',
      description: '用户每日签到获得5点经验，每日最多1次',
      type: 6,
      experience: 5,
      dailyLimit: 1,
      isEnabled: true,
      business: 'forum',
      eventKey: null,
    },
    {
      name: '管理员操作',
      description: '管理员手动调整用户经验，默认不启用',
      type: 7,
      experience: 0,
      dailyLimit: 0,
      isEnabled: false,
      business: 'forum',
      eventKey: null,
    },
  ]

  for (const ruleData of INITIAL_FORUM_EXPERIENCE_RULES) {
    const existingRule = await prisma.userExperienceRule.findFirst({
      where: { type: ruleData.type },
    })

    if (!existingRule) {
      await prisma.userExperienceRule.create({
        data: {
          type: ruleData.type,
          experience: ruleData.experience,
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
