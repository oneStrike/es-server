export async function createInitialClientUser(prisma: any) {
  const userData = {
    account: 'testuser',
    nickname: '测试用户',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=testuser',
    phone: '13800138000',
    email: 'test@example.com',
    isEnabled: true,
    gender: 1,
    isSignedIn: false,
  }

  await prisma.appUser.upsert({
    where: { account: userData.account },
    update: userData,
    create: userData,
  })
}
