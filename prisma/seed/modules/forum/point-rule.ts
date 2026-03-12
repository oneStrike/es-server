/**
 * 论坛积分规则种子数据
 *
 * 枚举值对照 (GrowthRuleTypeEnum):
 * - 1: 发表主题 (CREATE_TOPIC)
 * - 2: 发表回复 (CREATE_REPLY)
 * - 3: 主题被点赞 (TOPIC_LIKED)
 * - 4: 回复被点赞 (REPLY_LIKED)
 * - 5: 主题被收藏 (TOPIC_FAVORITED)
 * - 6: 每日签到 (DAILY_CHECK_IN)
 * - 7: 管理员操作 (ADMIN)
 * - 8: 主题浏览 (TOPIC_VIEW)
 * - 9: 举报主题 (TOPIC_REPORT)
 */
export interface IForumPointRuleData {
  description: string
  type: number
  points: number
  dailyLimit?: number
  isEnabled: boolean
}

export async function createInitialForumPointRules(prisma: any) {
  const INITIAL_FORUM_POINT_RULES: IForumPointRuleData[] = [
    {
      description: '每日登录奖励',
      type: 6,
      points: 5,
      dailyLimit: 1,
      isEnabled: true,
    },
    {
      description: '发布新主题奖励',
      type: 1,
      points: 10,
      isEnabled: true,
    },
    {
      description: '发布新回复奖励',
      type: 2,
      points: 5,
      isEnabled: true,
    },
    {
      description: '主题被点赞奖励',
      type: 3,
      points: 2,
      isEnabled: true,
    },
    {
      description: '回复被点赞奖励',
      type: 4,
      points: 2,
      isEnabled: true,
    },
    {
      description: '主题被收藏奖励',
      type: 5,
      points: 3,
      isEnabled: true,
    },
    {
      description: '浏览主题奖励',
      type: 8,
      points: 1,
      dailyLimit: 50,
      isEnabled: true,
    },
    {
      description: '举报内容奖励',
      type: 9,
      points: 2,
      dailyLimit: 5,
      isEnabled: false,
    },
  ]

  for (const ruleData of INITIAL_FORUM_POINT_RULES) {
    const existingRule = await prisma.userPointRule.findFirst({
      where: { type: ruleData.type },
    })

    if (!existingRule) {
      await prisma.userPointRule.create({
        data: {
          type: ruleData.type,
          points: ruleData.points,
          dailyLimit: ruleData.dailyLimit || 0,
          isEnabled: ruleData.isEnabled,
          remark: ruleData.description,
        },
      })
    }
  }
}
