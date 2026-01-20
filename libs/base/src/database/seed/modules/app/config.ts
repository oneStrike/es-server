export async function createInitialAppConfig(prisma: any) {
  const existingConfig = await prisma.appConfig.findFirst()
  if (existingConfig) {
    console.log('应用配置已存在，跳过填充')
    return existingConfig
  }

  const testUser = await prisma.appUser.findFirst({
    where: { account: 'testuser' },
  })

  const appConfig = await prisma.appConfig.create({
    data: {
      appName: '漫画阅读平台',
      appDesc: '提供优质漫画阅读体验的平台，支持多种漫画类型，随时随地享受阅读乐趣',
      appLogo: 'https://example.com/logo.png',
      onboardingImage: 'https://example.com/onboarding.png',
      enableMaintenanceMode: false,
      maintenanceMessage: '系统维护中，请稍后再来',
      version: '1.0.0',
      updatedById: testUser?.id,
    },
  })

  console.log('应用配置填充成功:', appConfig.id)
  return appConfig
}
