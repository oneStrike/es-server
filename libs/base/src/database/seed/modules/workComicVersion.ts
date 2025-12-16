export async function createInitialWorkComicVersions(prisma: any) {
  // 为一些漫画创建不同语言版本
  const versionData = [
    {
      comicName: '进击的巨人',
      versions: [
        {
          versionName: '中文版',
          language: 'zh-CN',
          translatorGroup: '官方中文',
          description: '官方授权中文版本',
          isRecommended: true,
          isPublished: true,
          publishAt: new Date('2024-01-01T00:00:00Z'),
          lastUpdated: new Date(),
          rating: 9.2,
          copyright: '© 諫山創/講談社',
          sortOrder: 1,
        },
        {
          versionName: '英文版',
          language: 'en-US',
          translatorGroup: 'Official English',
          description: 'Official English translation',
          isRecommended: false,
          isPublished: true,
          publishAt: new Date('2024-01-01T00:00:00Z'),
          lastUpdated: new Date(),
          rating: 9.0,
          copyright: '© Hajime Isayama/Kodansha',
          sortOrder: 2,
        },
      ],
    },
    {
      comicName: '海贼王',
      versions: [
        {
          versionName: '中文版',
          language: 'zh-CN',
          translatorGroup: '官方中文',
          description: '官方授权中文版本',
          isRecommended: true,
          isPublished: true,
          publishAt: new Date('2024-01-01T00:00:00Z'),
          lastUpdated: new Date(),
          rating: 9.5,
          copyright: '© 尾田栄一郎/集英社',
          sortOrder: 1,
        },
        {
          versionName: '日文原版',
          language: 'ja-JP',
          translatorGroup: null,
          description: '日文原版',
          isRecommended: false,
          isPublished: true,
          publishAt: new Date('2024-01-01T00:00:00Z'),
          lastUpdated: new Date(),
          rating: 9.6,
          copyright: '© 尾田栄一郎/集英社',
          sortOrder: 3,
        },
      ],
    },
    {
      comicName: '鬼灭之刃',
      versions: [
        {
          versionName: '中文版',
          language: 'zh-CN',
          translatorGroup: '官方中文',
          description: '官方授权中文版本',
          isRecommended: true,
          isPublished: true,
          publishAt: new Date('2024-01-01T00:00:00Z'),
          lastUpdated: new Date(),
          rating: 9.3,
          copyright: '© 吾峠呼世晴/集英社',
          sortOrder: 1,
        },
        {
          versionName: '繁体中文版',
          language: 'zh-TW',
          translatorGroup: '台湾东立',
          description: '繁体中文版本',
          isRecommended: false,
          isPublished: true,
          publishAt: new Date('2024-01-01T00:00:00Z'),
          lastUpdated: new Date(),
          rating: 9.2,
          copyright: '© 吾峠呼世晴/集英社',
          sortOrder: 2,
        },
      ],
    },
  ]

  for (const comicData of versionData) {
    const comic = await prisma.workComic.findFirst({
      where: { name: comicData.comicName },
    })

    if (comic) {
      for (const versionInfo of comicData.versions) {
        const existingVersion = await prisma.workComicVersion.findFirst({
          where: {
            comicId: comic.id,
            language: versionInfo.language,
            versionName: versionInfo.versionName,
          },
        })

        if (!existingVersion) {
          await prisma.workComicVersion.create({
            data: {
              ...versionInfo,
              comicId: comic.id,
            },
          })
        }
      }
    }
  }
}
