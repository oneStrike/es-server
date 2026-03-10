/**
 * 用户等级辅助函数。
 *
 * 说明：
 * - 根据用户经验值刷新用户等级
 * - 查找满足经验值要求的最高等级规则并更新用户等级
 */
export async function refreshUserLevelByExperience(
  tx: any,
  userId: number,
  experience: number,
) {
  const levelRule = await tx.userLevelRule.findFirst({
    where: {
      isEnabled: true,
      requiredExperience: { lte: experience },
    },
    orderBy: {
      requiredExperience: 'desc',
    },
    select: { id: true },
  })

  if (!levelRule) {
    return
  }

  await tx.appUser.update({
    where: { id: userId },
    data: { levelId: levelRule.id },
  })
}
