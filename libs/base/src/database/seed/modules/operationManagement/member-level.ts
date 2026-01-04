export async function createInitialMemberLevels(prisma: any) {
  const initData = [
    {
      name: '普通会员',
      level: 1,
      points: 0,
      loginDays: 0,
      icon: 'https://example.com/icons/member-level-1.png',
      description: '新注册用户，享受基础权益',
      isEnabled: true,
      blacklistLimit: 10,
      workCollectionLimit: 100,
      discount: 0.0,
      remark: '默认会员等级',
    },
    {
      name: '青铜会员',
      level: 2,
      points: 1000,
      loginDays: 10,
      icon: 'https://example.com/icons/member-level-2.png',
      description: '累计1000积分或连续登录10天，享受青铜会员权益',
      isEnabled: true,
      blacklistLimit: 20,
      workCollectionLimit: 200,
      discount: 0.95,
      remark: '入门级会员',
    },
    {
      name: '白银会员',
      level: 3,
      points: 5000,
      loginDays: 30,
      icon: 'https://example.com/icons/member-level-3.png',
      description: '累计5000积分或连续登录30天，享受白银会员权益',
      isEnabled: true,
      blacklistLimit: 30,
      workCollectionLimit: 300,
      discount: 0.9,
      remark: '中级会员',
    },
    {
      name: '黄金会员',
      level: 4,
      points: 10000,
      loginDays: 60,
      icon: 'https://example.com/icons/member-level-4.png',
      description: '累计10000积分或连续登录60天，享受黄金会员权益',
      isEnabled: true,
      blacklistLimit: 50,
      workCollectionLimit: 500,
      discount: 0.85,
      remark: '高级会员',
    },
    {
      name: '铂金会员',
      level: 5,
      points: 20000,
      loginDays: 90,
      icon: 'https://example.com/icons/member-level-5.png',
      description: '累计20000积分或连续登录90天，享受铂金会员权益',
      isEnabled: true,
      blacklistLimit: 100,
      workCollectionLimit: 1000,
      discount: 0.8,
      remark: '资深会员',
    },
    {
      name: '钻石会员',
      level: 6,
      points: 50000,
      loginDays: 180,
      icon: 'https://example.com/icons/member-level-6.png',
      description: '累计50000积分或连续登录180天，享受钻石会员权益',
      isEnabled: true,
      blacklistLimit: 200,
      workCollectionLimit: 2000,
      discount: 0.75,
      remark: '顶级会员',
    },
  ]

  for (const item of initData) {
    const existingLevel = await prisma.memberLevel.findFirst({
      where: { name: item.name },
    })

    if (!existingLevel) {
      await prisma.memberLevel.create({
        data: item,
      })
    }
  }
}
