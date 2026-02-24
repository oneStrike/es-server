interface IWorkPointRuleData {
  name: string
  description: string
  type: number
  points: number
  dailyLimit?: number
  isEnabled: boolean
  business?: string
  eventKey?: string | null
}

interface IWorkExperienceRuleData {
  name: string
  description: string
  type: number
  experience: number
  dailyLimit?: number
  isEnabled: boolean
  business?: string
  eventKey?: string | null
}

export async function createInitialWorkGrowthRules(prisma: any) {
  const INITIAL_WORK_POINT_RULES: IWorkPointRuleData[] = [
    {
      name: '作品浏览',
      description: '浏览作品获得1积分，每日最多50次',
      type: 101,
      points: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.view',
    },
    {
      name: '作品点赞',
      description: '点赞作品获得2积分，每日最多50次',
      type: 102,
      points: 2,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.like',
    },
    {
      name: '作品收藏',
      description: '收藏作品获得3积分，每日最多20次',
      type: 103,
      points: 3,
      dailyLimit: 20,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.favorite',
    },
    {
      name: '章节阅读',
      description: '阅读章节获得1积分，每日最多100次',
      type: 111,
      points: 1,
      dailyLimit: 100,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.chapter.read',
    },
    {
      name: '章节点赞',
      description: '点赞章节获得1积分，每日最多50次',
      type: 112,
      points: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.chapter.like',
    },
    {
      name: '章节购买',
      description: '购买章节获得5积分，每日最多50次',
      type: 113,
      points: 5,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.chapter.purchase',
    },
    {
      name: '章节下载',
      description: '下载章节获得1积分，每日最多20次',
      type: 114,
      points: 1,
      dailyLimit: 20,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.chapter.download',
    },
    {
      name: '作品评论',
      description: '评论作品获得2积分，每日最多30次',
      type: 121,
      points: 2,
      dailyLimit: 30,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comment.create',
    },
  ]

  const INITIAL_WORK_EXPERIENCE_RULES: IWorkExperienceRuleData[] = [
    {
      name: '作品浏览',
      description: '浏览作品获得1点经验，每日最多50次',
      type: 101,
      experience: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.view',
    },
    {
      name: '作品点赞',
      description: '点赞作品获得2点经验，每日最多50次',
      type: 102,
      experience: 2,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.like',
    },
    {
      name: '作品收藏',
      description: '收藏作品获得3点经验，每日最多20次',
      type: 103,
      experience: 3,
      dailyLimit: 20,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.favorite',
    },
    {
      name: '章节阅读',
      description: '阅读章节获得1点经验，每日最多100次',
      type: 111,
      experience: 1,
      dailyLimit: 100,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.chapter.read',
    },
    {
      name: '章节点赞',
      description: '点赞章节获得1点经验，每日最多50次',
      type: 112,
      experience: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.chapter.like',
    },
    {
      name: '章节购买',
      description: '购买章节获得5点经验，每日最多50次',
      type: 113,
      experience: 5,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.chapter.purchase',
    },
    {
      name: '章节下载',
      description: '下载章节获得1点经验，每日最多20次',
      type: 114,
      experience: 1,
      dailyLimit: 20,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.chapter.download',
    },
    {
      name: '作品评论',
      description: '评论作品获得2点经验，每日最多30次',
      type: 121,
      experience: 2,
      dailyLimit: 30,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comment.create',
    },
  ]

  for (const ruleData of INITIAL_WORK_POINT_RULES) {
    const existingRule = await prisma.userPointRule.findFirst({
      where: { type: ruleData.type },
    })

    if (!existingRule) {
      await prisma.userPointRule.create({
        data: {
          name: ruleData.name,
          type: ruleData.type,
          points: ruleData.points,
          dailyLimit: ruleData.dailyLimit ?? 0,
          isEnabled: ruleData.isEnabled,
          remark: ruleData.description,
          business: ruleData.business,
          eventKey: ruleData.eventKey ?? undefined,
        },
      })
    }
  }

  for (const ruleData of INITIAL_WORK_EXPERIENCE_RULES) {
    const existingRule = await prisma.userExperienceRule.findFirst({
      where: { type: ruleData.type },
    })

    if (!existingRule) {
      await prisma.userExperienceRule.create({
        data: {
          type: ruleData.type,
          experience: ruleData.experience,
          dailyLimit: ruleData.dailyLimit ?? 0,
          isEnabled: ruleData.isEnabled,
          remark: ruleData.description,
          business: ruleData.business,
          eventKey: ruleData.eventKey ?? undefined,
        },
      })
    }
  }
}
