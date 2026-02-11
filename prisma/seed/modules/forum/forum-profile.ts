export async function createInitialForumProfile(prisma: any) {
  const user = await prisma.appUser.findFirst({
    where: { phone: '13800138000' },
  })

  if (!user) {
    return
  }

  const level = await prisma.userLevelRule.findFirst({
    where: { name: '初级会员' },
  })

  if (!level) {
    return
  }

  const profileData = {
    userId: user.id,
    topicCount: 0,
    replyCount: 0,
    likeCount: 0,
    favoriteCount: 0,
    signature: '这是我的个人签名',
    bio: '这是我的个人简介',
  }

  await prisma.appUser.update({
    where: { id: user.id },
    data: {
      points: 0,
      experience: 0,
      levelId: level.id,
      status: 1,
    },
  })

  await prisma.forumProfile.upsert({
    where: { userId: profileData.userId },
    update: profileData,
    create: profileData,
  })
}
