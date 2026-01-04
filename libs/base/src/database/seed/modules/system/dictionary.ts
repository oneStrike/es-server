interface IDictionaryData {
  name: string
  code: string
}

interface IDictionaryItemData {
  name: string
  code: string
}

export async function createInitialDataDictionary(prisma: any) {
  const initData: IDictionaryData[] = [
    {
      name: '作品语言',
      code: 'work_language',
    },
    {
      name: '国籍',
      code: 'nationality',
    },
    {
      name: '作品区域',
      code: 'work_region',
    },
    {
      name: '作品出版社',
      code: 'work_publisher',
    },
    {
      name: '作品年龄限制',
      code: 'work_age_rating',
    },
  ]
  const itemData: Record<string, IDictionaryItemData[]> = {
    work_language: [
      {
        name: '中文',
        code: 'ZH',
      },
      {
        name: '英文',
        code: 'EN',
      },
      {
        name: '日文',
        code: 'JP',
      },
      {
        name: '韩文',
        code: 'KR',
      },
      {
        name: '法文',
        code: 'FR',
      },
    ],
    work_region: [
      {
        name: '中国',
        code: 'CN',
      },
      {
        name: '美国',
        code: 'US',
      },
      {
        name: '日本',
        code: 'JP',
      },
      {
        name: '韩国',
        code: 'KR',
      },
      {
        name: '欧洲',
        code: 'EU',
      },
    ],
    work_age_rating: [
      {
        name: '全年龄',
        code: 'ALL',
      },
      {
        name: 'R15',
        code: 'R15',
      },
      {
        name: 'R18',
        code: 'R18',
      },
    ],
    nationality: [
      {
        name: '中国',
        code: 'CN',
      },
      {
        name: '美国',
        code: 'US',
      },
      {
        name: '日本',
        code: 'JP',
      },
      {
        name: '韩国',
        code: 'KR',
      },
      {
        name: '英国',
        code: 'GB',
      },
      {
        name: '法国',
        code: 'FR',
      },
      {
        name: '德国',
        code: 'DE',
      },
      {
        name: '印度',
        code: 'IN',
      },
      {
        name: '俄罗斯',
        code: 'RU',
      },
      {
        name: '巴西',
        code: 'BR',
      },
    ],
    work_publisher: [
      {
        name: '人民文学出版社',
        code: 'renmin_wenxue_chubanshe',
      },
      {
        name: '人民教育出版社',
        code: 'renmin_jiaoyu_chubanshe',
      },
      {
        name: '人民音乐出版社',
        code: 'renmin_yinyue_chubanshe',
      },
      {
        name: '人民美术出版社',
        code: 'renmin_meishu_chubanshe',
      },
      {
        name: '集英社',
        code: 'shueisha',
      },
      {
        name: '小学馆',
        code: 'shogakukan',
      },
    ],
  }

  for (const item of initData) {
    const existingDictionary = await prisma.dictionary.findFirst({
      where: { code: item.code },
    })

    if (!existingDictionary) {
      await prisma.dictionary.create({
        data: item,
      })
    }

    if (!itemData[item.code]) {
      continue
    }

    for (const subItem of itemData[item.code]) {
      const existingItem = await prisma.dictionaryItem.findFirst({
        where: {
          dictionaryCode: item.code,
          code: subItem.code,
        },
      })

      if (!existingItem) {
        await prisma.dictionaryItem.create({
          data: {
            ...subItem,
            parentDictionary: {
              connect: { code: item.code },
            },
          },
        })
      }
    }
  }
}
