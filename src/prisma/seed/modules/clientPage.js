export async function createInitialClientPage(prisma) {
  const initData = [
    {
      code: 'home',
      path: '/',
      name: '首页',
      title: '首页 - 漫画阅读平台',
      accessLevel: 0, // 游客可访问
      isEnabled: true, // 启用
      description: '平台首页，展示推荐内容和热门作品',
    },
    {
      code: 'comic_list',
      path: '/comic/list',
      name: '漫画列表',
      title: '漫画列表 - 漫画阅读平台',
      accessLevel: 0,
      isEnabled: true,
      description: '漫画作品列表页面',
    },
    {
      code: 'comic_detail',
      path: '/comic/detail',
      name: '漫画详情',
      title: '漫画详情 - 漫画阅读平台',
      accessLevel: 0,
      isEnabled: true,
      description: '漫画作品详情页面',
    },
    {
      code: 'comic_reader',
      path: '/comic/reader',
      name: '漫画阅读',
      title: '漫画阅读 - 漫画阅读平台',
      accessLevel: 1, // 需要登录
      isEnabled: true,
      description: '漫画在线阅读页面',
    },
    {
      code: 'user_center',
      path: '/user/center',
      name: '个人中心',
      title: '个人中心 - 漫画阅读平台',
      accessLevel: 1, // 需要登录
      isEnabled: true,
      description: '用户个人中心页面',
    },
    {
      code: 'user_profile',
      path: '/user/profile',
      name: '个人资料',
      title: '个人资料 - 漫画阅读平台',
      accessLevel: 1, // 需要登录
      isEnabled: true,
      description: '用户个人资料设置页面',
    },
    {
      code: 'vip_center',
      path: '/vip/center',
      name: 'VIP中心',
      title: 'VIP中心 - 漫画阅读平台',
      accessLevel: 2, // 需要会员
      isEnabled: true,
      description: 'VIP会员专属页面',
    },
    {
      code: 'about',
      path: '/about',
      name: '关于我们',
      title: '关于我们 - 漫画阅读平台',
      accessLevel: 0,
      isEnabled: true,
      description: '平台介绍和联系方式',
    },
    {
      code: 'privacy',
      path: '/privacy',
      name: '隐私政策',
      title: '隐私政策 - 漫画阅读平台',
      accessLevel: 0,
      isEnabled: true,
      description: '用户隐私政策说明',
    },
    {
      code: 'terms',
      path: '/terms',
      name: '服务条款',
      title: '服务条款 - 漫画阅读平台',
      accessLevel: 0,
      isEnabled: true,
      description: '平台服务条款和使用协议',
    },
  ]

  for (const item of initData) {
    await prisma.clientPage.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    })
  }
}
