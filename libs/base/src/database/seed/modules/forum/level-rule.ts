interface IForumLevelRuleData {
  name: string
  requiredPoints: number
  icon: string
  description: string
  order: number
  isEnabled: boolean
  levelColor?: string
  levelBadge?: string
  dailyTopicLimit?: number
  dailyReplyLimit?: number
  postInterval?: number
  maxFileSize?: number
  dailyLikeLimit?: number
  dailyFavoriteLimit?: number
  dailyCommentLimit?: number
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
      levelColor: '#909399',
      dailyTopicLimit: 5,
      dailyReplyLimit: 20,
      postInterval: 30,
      maxFileSize: 2048,
      dailyLikeLimit: 30,
      dailyFavoriteLimit: 10,
      dailyCommentLimit: 50,
    },
    {
      name: '中级会员',
      requiredPoints: 100,
      icon: '🥈',
      description: '累计100积分，享受中级会员权益',
      order: 2,
      isEnabled: true,
      levelColor: '#409EFF',
      dailyTopicLimit: 10,
      dailyReplyLimit: 50,
      postInterval: 20,
      maxFileSize: 5120,
      dailyLikeLimit: 50,
      dailyFavoriteLimit: 20,
      dailyCommentLimit: 100,
    },
    {
      name: '高级会员',
      requiredPoints: 500,
      icon: '🥇',
      description: '累计500积分，享受高级会员权益',
      order: 3,
      isEnabled: true,
      levelColor: '#67C23A',
      dailyTopicLimit: 20,
      dailyReplyLimit: 100,
      postInterval: 10,
      maxFileSize: 10240,
      dailyLikeLimit: 100,
      dailyFavoriteLimit: 50,
      dailyCommentLimit: 200,
    },
    {
      name: '资深会员',
      requiredPoints: 2000,
      icon: '💎',
      description: '累计2000积分，享受资深会员权益',
      order: 4,
      isEnabled: true,
      levelColor: '#E6A23C',
      dailyTopicLimit: 30,
      dailyReplyLimit: 200,
      postInterval: 5,
      maxFileSize: 20480,
      dailyLikeLimit: 200,
      dailyFavoriteLimit: 100,
      dailyCommentLimit: 500,
    },
    {
      name: '专家会员',
      requiredPoints: 5000,
      icon: '👑',
      description: '累计5000积分，享受专家会员权益',
      order: 5,
      isEnabled: true,
      levelColor: '#F56C6C',
      dailyTopicLimit: 50,
      dailyReplyLimit: 500,
      postInterval: 0,
      maxFileSize: 51200,
      dailyLikeLimit: 500,
      dailyFavoriteLimit: 200,
      dailyCommentLimit: 1000,
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
          requiredPoints: levelData.requiredPoints,
          icon: levelData.icon,
          description: levelData.description,
          sortOrder: levelData.order,
          isEnabled: levelData.isEnabled,
          levelColor: levelData.levelColor,
          levelBadge: levelData.levelBadge,
          dailyTopicLimit: levelData.dailyTopicLimit,
          dailyReplyLimit: levelData.dailyReplyLimit,
          postInterval: levelData.postInterval,
          maxFileSize: levelData.maxFileSize,
          dailyLikeLimit: levelData.dailyLikeLimit,
          dailyFavoriteLimit: levelData.dailyFavoriteLimit,
          dailyCommentLimit: levelData.dailyCommentLimit,
        },
      })
    }
  }
}
