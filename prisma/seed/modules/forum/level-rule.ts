interface IForumLevelRuleData {
  name: string
  requiredExperience: number
  icon: string
  description: string
  order: number
  isEnabled: boolean
  color?: string
  badge?: string
  dailyTopicLimit?: number
  dailyReplyCommentLimit?: number
  postInterval?: number
  dailyLikeLimit?: number
  dailyFavoriteLimit?: number
  discount?: number
  workCollectionLimit?: number
  blacklistLimit?: number
  loginDays?: number
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
      discount: 0,
      workCollectionLimit: 100,
      blacklistLimit: 10,
      loginDays: 0,
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
      discount: 0.95,
      workCollectionLimit: 200,
      blacklistLimit: 20,
      loginDays: 10,
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
      discount: 0.90,
      workCollectionLimit: 300,
      blacklistLimit: 30,
      loginDays: 30,
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
      discount: 0.85,
      workCollectionLimit: 500,
      blacklistLimit: 50,
      loginDays: 60,
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
      discount: 0.80,
      workCollectionLimit: 1000,
      blacklistLimit: 100,
      loginDays: 90,
    },
  ]

  for (const levelData of INITIAL_FORUM_LEVEL_RULES) {
    const existingLevel = await prisma.appLevelRule.findFirst({
      where: { name: levelData.name },
    })

    if (!existingLevel) {
      await prisma.appLevelRule.create({
        data: {
          name: levelData.name,
          requiredExperience: levelData.requiredExperience,
          icon: levelData.icon,
          description: levelData.description,
          sortOrder: levelData.order,
          isEnabled: levelData.isEnabled,
          color: levelData.color,
          badge: levelData.badge,
          dailyTopicLimit: levelData.dailyTopicLimit,
          dailyReplyCommentLimit: levelData.dailyReplyCommentLimit,
          postInterval: levelData.postInterval,
          dailyLikeLimit: levelData.dailyLikeLimit,
          dailyFavoriteLimit: levelData.dailyFavoriteLimit,
          discount: levelData.discount,
          workCollectionLimit: levelData.workCollectionLimit,
          blacklistLimit: levelData.blacklistLimit,
          loginDays: levelData.loginDays,
        },
      })
    }
  }
}
