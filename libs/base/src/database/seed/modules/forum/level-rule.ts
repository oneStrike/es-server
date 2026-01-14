interface IForumLevelRuleData {
  name: string
  requiredExperience: number
  icon: string
  description: string
  order: number
  isEnabled: boolean
  color?: string
  levelBadge?: string
  dailyTopicLimit?: number
  dailyReplyCommentLimit?: number
  postInterval?: number
  dailyLikeLimit?: number
  dailyFavoriteLimit?: number
}

export async function createInitialForumLevelRules(prisma: any) {
  const INITIAL_FORUM_LEVEL_RULES: IForumLevelRuleData[] = [
    {
      name: '初级会员',
      requiredExperience: 0,
      icon: '🥉',
      description: '新注册用户，享受基础权益',
      order: 1,
      isEnabled: true,
      color: '#909399',
      dailyTopicLimit: 5,
      dailyReplyCommentLimit: 70,
      postInterval: 30,
      dailyLikeLimit: 30,
      dailyFavoriteLimit: 10,
    },
    {
      name: '中级会员',
      requiredExperience: 100,
      icon: '🥈',
      description: '累计100积分，享受中级会员权益',
      order: 2,
      isEnabled: true,
      color: '#409EFF',
      dailyTopicLimit: 10,
      dailyReplyCommentLimit: 150,
      postInterval: 20,
      dailyLikeLimit: 50,
      dailyFavoriteLimit: 20,
    },
    {
      name: '高级会员',
      requiredExperience: 500,
      icon: '🥇',
      description: '累计500积分，享受高级会员权益',
      order: 3,
      isEnabled: true,
      color: '#67C23A',
      dailyTopicLimit: 20,
      dailyReplyCommentLimit: 300,
      postInterval: 10,
      dailyLikeLimit: 100,
      dailyFavoriteLimit: 50,
    },
    {
      name: '资深会员',
      requiredExperience: 2000,
      icon: '💎',
      description: '累计2000积分，享受资深会员权益',
      order: 4,
      isEnabled: true,
      color: '#E6A23C',
      dailyTopicLimit: 30,
      dailyReplyCommentLimit: 700,
      postInterval: 5,
      dailyLikeLimit: 200,
      dailyFavoriteLimit: 100,
    },
    {
      name: '专家会员',
      requiredExperience: 5000,
      icon: '👑',
      description: '累计5000积分，享受专家会员权益',
      order: 5,
      isEnabled: true,
      color: '#F56C6C',
      dailyTopicLimit: 50,
      dailyReplyCommentLimit: 1500,
      postInterval: 0,
      dailyLikeLimit: 500,
      dailyFavoriteLimit: 200,
    },
  ]

  for (const levelData of INITIAL_FORUM_LEVEL_RULES) {
    const existingLevel = await prisma.forumLevelRule.findFirst({
      where: { name: levelData.name },
    })

    if (!existingLevel) {
      await prisma.forumLevelRule.create({
        data: {
          name: levelData.name,
          requiredExperience: levelData.requiredExperience,
          icon: levelData.icon,
          description: levelData.description,
          sortOrder: levelData.order,
          isEnabled: levelData.isEnabled,
          color: levelData.color,
          levelBadge: levelData.levelBadge,
          dailyTopicLimit: levelData.dailyTopicLimit,
          dailyReplyCommentLimit: levelData.dailyReplyCommentLimit,
          postInterval: levelData.postInterval,
          dailyLikeLimit: levelData.dailyLikeLimit,
          dailyFavoriteLimit: levelData.dailyFavoriteLimit,
        },
      })
    }
  }
}
