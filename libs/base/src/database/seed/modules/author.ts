export async function createInitialAuthors(prisma: any) {
  const initData = [
    {
      name: '村上春树',
      avatar: 'https://example.com/avatars/haruki-murakami.jpg',
      description: '日本著名小说家，代表作有《挪威的森林》、《海边的卡夫卡》等',
      isEnabled: true,
      nationality: '日本',
      gender: 1,
      remark: '国际知名作家，作品深受读者喜爱',
      worksCount: 0,
      followersCount: 0,
      isRecommended: true,
      type: [1]
    },
    {
      name: '东野圭吾',
      avatar: 'https://example.com/avatars/keigo-higashino.jpg',
      description: '日本推理小说家，代表作有《白夜行》、《嫌疑人X的献身》等',
      isEnabled: true,
      nationality: '日本',
      gender: 1,
      remark: '推理小说大师，作品逻辑严密',
      worksCount: 0,
      followersCount: 0,
      isRecommended: true,
      type: [1]
    },
    {
      name: '尾田荣一郎',
      avatar: 'https://example.com/avatars/eiichiro-oda.jpg',
      description: '日本漫画家，《海贼王》作者',
      isEnabled: true,
      nationality: '日本',
      gender: 1,
      remark: '世界知名漫画家，海贼王创作者',
      worksCount: 0,
      followersCount: 0,
      isRecommended: true,
      type: [1]
    },
    {
      name: '鸟山明',
      avatar: 'https://example.com/avatars/akira-toriyama.jpg',
      description: '日本漫画家，《龙珠》、《阿拉蕾》作者',
      isEnabled: true,
      nationality: '日本',
      gender: 1,
      remark: '传奇漫画家，影响了一代人',
      worksCount: 0,
      followersCount: 0,
      isRecommended: true,
      type: [1]
    },
  ]
  for (const item of initData) {
    // 由于没有唯一约束，我们使用name作为判断条件
    const existingNotice = await prisma.workAuthor.findFirst({
      where: { name: item.name },
    })

    if (!existingNotice) {
      await prisma.workAuthor.upsert({
        where: { name: item.name },
        update: item,
        create: item,
      })
    }
  }
}
