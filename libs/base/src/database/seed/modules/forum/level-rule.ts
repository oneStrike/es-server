interface IForumLevelRuleData {
  name: string
  requiredPoints: number
  icon: string
  description: string
  order: number
  isEnabled: boolean
}

export async function createInitialForumLevelRules(prisma: any) {
  const INITIAL_FORUM_LEVEL_RULES: IForumLevelRuleData[] = [
    {
      name: '初级会员',
      requiredPoints: 0,
      icon: '🥉',
      description: '新注册用户，享受基础权益',
      order: 1,
      isEnabled: true,
    },
    {
      name: '中级会员',
      requiredPoints: 100,
      icon: '🥈',
      description: '累计100积分，享受中级会员权益',
      order: 2,
      isEnabled: true,
    },
    {
      name: '高级会员',
      requiredPoints: 500,
      icon: '🥇',
      description: '累计500积分，享受高级会员权益',
      order: 3,
      isEnabled: true,
    },
    {
      name: '资深会员',
      requiredPoints: 2000,
      icon: '💎',
      description: '累计2000积分，享受资深会员权益',
      order: 4,
      isEnabled: true,
    },
    {
      name: '专家会员',
      requiredPoints: 5000,
      icon: '👑',
      description: '累计5000积分，享受专家会员权益',
      order: 5,
      isEnabled: true,
    },
  ]

  for (const levelData of INITIAL_FORUM_LEVEL_RULES) {
    const existingLevel = await prisma.forumLevelRule.findFirst({
      where: { name: levelData.name },
    })

    if (!existingLevel) {
      await prisma.forumLevelRule.create({
        data: levelData,
      })
    }
  }
}
