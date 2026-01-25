export async function createInitialForumProfile(prisma: any) {
  const user = await prisma.appUser.findFirst({
    where: { phone: '13800138000' },
  })

  if (!user) {
    return
  }

  const level = await prisma.forumLevelRule.findFirst({
    where: { name: '初级会员' },
  })

  if (!level) {
    return
  }

  const profileData = {
    userId: user.id,
    points: 0,
    levelId: level.id,
    topicCount: 0,
    replyCount: 0,
    likeCount: 0,
    favoriteCount: 0,
    signature: '这是我的个人签名',
    bio: '这是我的个人简介',
    status: 1,
  }

  await prisma.forumProfile.upsert({
    where: { userId: profileData.userId },
    update: profileData,
    create: profileData,
  })
}
