/**
 * Interaction growth rule seeds.
 *
 * Rule types:
 * - 10: CREATE_COMMENT
 * - 11: COMMENT_LIKED
 */
export async function createInitialInteractionGrowthRules(prisma: any) {
  const pointRules = [
    {
      type: 10,
      points: 2,
      dailyLimit: 20,
      totalLimit: 0,
      isEnabled: true,
      remark: '发表评论获得积分',
    },
    {
      type: 11,
      points: 1,
      dailyLimit: 0,
      totalLimit: 0,
      isEnabled: true,
      remark: '评论被点赞获得积分',
    },
  ]

  const experienceRules = [
    {
      type: 10,
      experience: 2,
      dailyLimit: 20,
      totalLimit: 0,
      isEnabled: true,
      remark: '发表评论获得经验',
    },
    {
      type: 11,
      experience: 1,
      dailyLimit: 0,
      totalLimit: 0,
      isEnabled: true,
      remark: '评论被点赞获得经验',
    },
  ]

  for (const rule of pointRules) {
    const exists = await prisma.userPointRule.findFirst({
      where: { type: rule.type },
      select: { id: true },
    })
    if (!exists) {
      await prisma.userPointRule.create({ data: rule })
    }
  }

  for (const rule of experienceRules) {
    const exists = await prisma.userExperienceRule.findFirst({
      where: { type: rule.type },
      select: { id: true },
    })
    if (!exists) {
      await prisma.userExperienceRule.create({ data: rule })
    }
  }
}
