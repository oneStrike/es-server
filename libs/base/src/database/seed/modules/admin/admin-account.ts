export async function createInitialAdminAccount(prisma: any) {
  const accountInfo = {
    username: 'admin',
    mobile: '18888888888',
    isEnabled: true,
    role: 0,
    password:
      'e54d37047759e69ae2ffd34850ce3281.0275adf4e59d2e4e5d64f8694e327a0e8960a81bcecde7b47eaf3d76878f50b1b8ec520eb1bc0171336ec0dfb07f78611672be9fa335e1834cff45ebb68a98ac',
  }
  await prisma.adminUser.upsert({
    where: { username: accountInfo.username },
    update: accountInfo,
    create: accountInfo,
  })
}
