export async function refreshUserLevelByExperience(
  tx: any,
  userId: number,
  experience: number,
): Promise<void> {
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
