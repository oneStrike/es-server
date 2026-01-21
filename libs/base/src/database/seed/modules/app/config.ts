export async function createInitialAppConfig(prisma: any) {
  const existingConfig = await prisma.appConfig.findFirst()

  const testUser = await prisma.appUser.findFirst({
    where: { account: 'testuser' },
  })

  const configData = {
    appName: '漫画阅读平台',
    appDesc: '提供优质漫画阅读体验的平台，支持多种漫画类型，随时随地享受阅读乐趣',
    appLogo: 'https://example.com/logo.png',
    onboardingImage: 'https://example.com/onboarding.png',
    themeColor: '#007AFF',
    secondaryColor: '#5856D6',
    optionalThemeColors: '#FF9500,#FF3B30,#4CD964,#5AC8FA,#007AFF',
    enableMaintenanceMode: false,
    maintenanceMessage: '系统维护中，请稍后再来',
    version: '1.0.0',
    updatedById: testUser?.id,
  }

  let appConfig

  if (existingConfig) {
    appConfig = await prisma.appConfig.update({
      where: { id: existingConfig.id },
      data: configData,
    })
    console.log('应用配置已更新:', appConfig.id)
  } else {
    appConfig = await prisma.appConfig.create({
      data: configData,
    })
    console.log('应用配置填充成功:', appConfig.id)
  }

  return appConfig
}
