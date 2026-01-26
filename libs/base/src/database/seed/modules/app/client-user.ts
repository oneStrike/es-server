export async function createInitialClientUser(prisma: any) {
  const userData = {
    account: 123456,
    nickname: '测试用户',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=testuser',
    phone: '13800138000',
    email: 'test@example.com',
    isEnabled: true,
    gender: 1,
    password: 'e54d37047759e69ae2ffd34850ce3281.0275adf4e59d2e4e5d64f8694e327a0e8960a81bcecde7b47eaf3d76878f50b1b8ec520eb1bc0171336ec0dfb07f78611672be9fa335e1834cff45ebb68a98ac',
  }

  await prisma.appUser.upsert({
    where: { phone: userData.phone },
    update: userData,
    create: userData,
  })
}
