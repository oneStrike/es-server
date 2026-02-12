export async function createInitialComics(prisma: any) {
  const initData = [
    {
      name: '进击的巨人',
      alias: 'Attack on Titan,進撃の巨人',
      cover: 'https://example.com/covers/attack-on-titan.jpg',
      popularity: 9500,
      language: 'ja-JP',
      region: 'JP',
      ageRating: 'R-15',
      isPublished: true,
      publishAt: new Date('2024-01-01'),
      lastUpdated: new Date(),
      description:
        '在这个世界上，人类居住在由三重巨大的城墙所围成的都市里。在城墙外面，有着似乎会捕食人类的巨人类生物「巨人」徘徊着，而唯一对外的通道只有各城墙上的门扉而已。',
      publisher: '讲谈社',
      originalSource: '官方授权',
      serialStatus: 1,
      rating: 9.2,
      ratingCount: 12500,
      recommendWeight: 150,
      isRecommended: true,
      isHot: true,
      isNew: false,
      copyright: '© 諫山創・講談社',
      disclaimer: '本作品仅供娱乐，不代表任何立场',
      remark: '经典漫画作品，推荐首页展示',
    },
    {
      name: '海贼王',
      alias: 'One Piece,ワンピース',
      cover: 'https://example.com/covers/one-piece.jpg',
      popularity: 9800,
      language: 'ja-JP',
      region: 'JP',
      ageRating: 'PG-13',
      isPublished: true,
      publishAt: new Date('2024-01-01'),
      lastUpdated: new Date(),
      description:
        '拥有财富、名声、权力，这世界上的一切的男人 "海贼王" 哥尔·D·罗杰，在被行刑受死之前说了一句话，让全世界的人都涌向了大海。"想要我的宝藏吗？如果想要的话，那就到海上去找吧，我全部都放在那里。"',
      publisher: '集英社',
      originalSource: '官方授权',
      serialStatus: 0,
      rating: 9.5,
      ratingCount: 18000,
      recommendWeight: 180,
      isRecommended: true,
      isHot: true,
      isNew: false,
      copyright: '© 尾田栄一郎/集英社',
      disclaimer: '本作品仅供娱乐，不代表任何立场',
      remark: '超人气长篇漫画，必推作品',
    },
    {
      name: '鬼灭之刃',
      alias: 'Demon Slayer,鬼滅の刃',
      cover: 'https://example.com/covers/demon-slayer.jpg',
      popularity: 9200,
      language: 'ja-JP',
      region: 'JP',
      ageRating: 'R-15',
      isPublished: true,
      publishAt: new Date('2024-01-01'),
      lastUpdated: new Date(),
      description:
        '大正时代，卖炭少年炭治郎的平凡生活，在家人遭到鬼杀害的那一天发生剧变。唯一幸存但变成了鬼的妹妹祢豆子，以及追踪而来的鬼杀队剑士富冈义勇。',
      publisher: '集英社',
      originalSource: '官方授权',
      serialStatus: 1,
      rating: 9.0,
      ratingCount: 15000,
      recommendWeight: 130,
      isRecommended: true,
      isHot: true,
      isNew: false,
      copyright: '© 吾峠呼世晴/集英社',
      disclaimer: '本作品仅供娱乐，不代表任何立场',
      remark: '现象级漫画作品，强烈推荐',
    },
    {
      name: '你的名字',
      alias: 'Your Name,君の名は',
      cover: 'https://example.com/covers/your-name.jpg',
      popularity: 8500,
      language: 'ja-JP',
      region: 'JP',
      ageRating: 'PG',
      isPublished: true,
      publishAt: new Date('2024-01-01'),
      lastUpdated: new Date(),
      description:
        '住在日本乡下的女高中生宫水三叶，和住在东京的男高中生立花泰树，两人在梦中交换了身体。起初以为只是奇怪的梦，但逐渐意识到彼此确实在交换身体...',
      publisher: 'KADOKAWA',
      originalSource: '官方授权',
      serialStatus: 1,
      rating: 8.8,
      ratingCount: 9500,
      recommendWeight: 100,
      isRecommended: false,
      isHot: false,
      isNew: true,
      copyright: '© 新海誠/KADOKAWA',
      disclaimer: '本作品仅供娱乐，不代表任何立场',
      remark: '温馨治愈系作品，适合青少年阅读',
    },
    {
      name: '龙珠',
      alias: 'Dragon Ball,ドラゴンボール',
      cover: 'https://example.com/covers/dragon-ball.jpg',
      popularity: 9000,
      language: 'ja-JP',
      region: 'JP',
      ageRating: 'PG-13',
      isPublished: true,
      publishAt: new Date('2024-01-01'),
      lastUpdated: new Date(),
      description:
        '在很久很久以前，有一个叫做孙悟空的少年，他拥有着惊人的力量和纯真的心灵。为了寻找传说中的龙珠，他踏上了冒险的旅程...',
      publisher: '集英社',
      originalSource: '官方授权',
      serialStatus: 1,
      rating: 9.3,
      ratingCount: 16800,
      recommendWeight: 160,
      isRecommended: true,
      isHot: false,
      isNew: false,
      copyright: '© 鳥山明/集英社',
      disclaimer: '本作品仅供娱乐，不代表任何立场',
      remark: '经典热血漫画，影响深远',
    },
    {
      name: '火影忍者',
      alias: 'Naruto,ナルト',
      cover: 'https://example.com/covers/naruto.jpg',
      popularity: 9300,
      language: 'ja-JP',
      region: 'JP',
      ageRating: 'PG-13',
      isPublished: true,
      publishAt: new Date('2024-01-01'),
      lastUpdated: new Date(),
      description:
        '漩涡鸣人是一个在木叶忍者村长大的孤儿，他的体内封印着九尾妖狐。因为被村里人视为不祥之物，鸣人从小就饱受孤独和歧视。为了获得大家的认可，他立志成为火影...',
      publisher: '集英社',
      originalSource: '官方授权',
      serialStatus: 1,
      rating: 9.1,
      ratingCount: 14500,
      recommendWeight: 140,
      isRecommended: true,
      isHot: true,
      isNew: false,
      copyright: '© 岸本斉史/集英社',
      disclaimer: '本作品仅供娱乐，不代表任何立场',
      remark: '经典少年漫画，热血励志',
    },
  ]

  for (const item of initData) {
    const existingComic = await prisma.workComic.findFirst({
      where: { name: item.name },
    })

    if (!existingComic) {
      await prisma.workComic.create({
        data: item,
      })
    }
  }
}

interface IComicPointRuleData {
  name: string
  description: string
  type: number
  points: number
  dailyLimit?: number
  isEnabled: boolean
  business?: string
  eventKey?: string | null
}

interface IComicExperienceRuleData {
  name: string
  description: string
  type: number
  experience: number
  dailyLimit?: number
  isEnabled: boolean
  business?: string
  eventKey?: string | null
}

export async function createInitialComicGrowthRules(prisma: any) {
  const INITIAL_COMIC_POINT_RULES: IComicPointRuleData[] = [
    {
      name: '漫画浏览',
      description: '浏览漫画获得1积分，每日最多50次',
      type: 101,
      points: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'comic',
      eventKey: 'comic.work.view',
    },
    {
      name: '漫画点赞',
      description: '点赞漫画获得2积分，每日最多50次',
      type: 102,
      points: 2,
      dailyLimit: 50,
      isEnabled: true,
      business: 'comic',
      eventKey: 'comic.work.like',
    },
    {
      name: '漫画收藏',
      description: '收藏漫画获得3积分，每日最多20次',
      type: 103,
      points: 3,
      dailyLimit: 20,
      isEnabled: true,
      business: 'comic',
      eventKey: 'comic.work.favorite',
    },
    {
      name: '章节阅读',
      description: '阅读章节获得1积分，每日最多100次',
      type: 111,
      points: 1,
      dailyLimit: 100,
      isEnabled: true,
      business: 'comic',
      eventKey: 'comic.chapter.read',
    },
    {
      name: '章节点赞',
      description: '点赞章节获得1积分，每日最多50次',
      type: 112,
      points: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'comic',
      eventKey: 'comic.chapter.like',
    },
    {
      name: '章节购买',
      description: '购买章节获得5积分，每日最多50次',
      type: 113,
      points: 5,
      dailyLimit: 50,
      isEnabled: true,
      business: 'comic',
      eventKey: 'comic.chapter.purchase',
    },
    {
      name: '章节下载',
      description: '下载章节获得1积分，每日最多20次',
      type: 114,
      points: 1,
      dailyLimit: 20,
      isEnabled: true,
      business: 'comic',
      eventKey: 'comic.chapter.download',
    },
  ]

  const INITIAL_COMIC_EXPERIENCE_RULES: IComicExperienceRuleData[] = [
    {
      name: '漫画浏览',
      description: '浏览漫画获得1点经验，每日最多50次',
      type: 101,
      experience: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'comic',
      eventKey: 'comic.work.view',
    },
    {
      name: '漫画点赞',
      description: '点赞漫画获得2点经验，每日最多50次',
      type: 102,
      experience: 2,
      dailyLimit: 50,
      isEnabled: true,
      business: 'comic',
      eventKey: 'comic.work.like',
    },
    {
      name: '漫画收藏',
      description: '收藏漫画获得3点经验，每日最多20次',
      type: 103,
      experience: 3,
      dailyLimit: 20,
      isEnabled: true,
      business: 'comic',
      eventKey: 'comic.work.favorite',
    },
    {
      name: '章节阅读',
      description: '阅读章节获得1点经验，每日最多100次',
      type: 111,
      experience: 1,
      dailyLimit: 100,
      isEnabled: true,
      business: 'comic',
      eventKey: 'comic.chapter.read',
    },
    {
      name: '章节点赞',
      description: '点赞章节获得1点经验，每日最多50次',
      type: 112,
      experience: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'comic',
      eventKey: 'comic.chapter.like',
    },
    {
      name: '章节购买',
      description: '购买章节获得5点经验，每日最多50次',
      type: 113,
      experience: 5,
      dailyLimit: 50,
      isEnabled: true,
      business: 'comic',
      eventKey: 'comic.chapter.purchase',
    },
    {
      name: '章节下载',
      description: '下载章节获得1点经验，每日最多20次',
      type: 114,
      experience: 1,
      dailyLimit: 20,
      isEnabled: true,
      business: 'comic',
      eventKey: 'comic.chapter.download',
    },
  ]

  for (const ruleData of INITIAL_COMIC_POINT_RULES) {
    const existingRule = await prisma.userPointRule.findFirst({
      where: { type: ruleData.type },
    })

    if (!existingRule) {
      await prisma.userPointRule.create({
        data: {
          type: ruleData.type,
          points: ruleData.points,
          dailyLimit: ruleData.dailyLimit ?? 0,
          isEnabled: ruleData.isEnabled,
          remark: ruleData.description,
          business: ruleData.business,
          eventKey: ruleData.eventKey ?? undefined,
        },
      })
    }
  }

  for (const ruleData of INITIAL_COMIC_EXPERIENCE_RULES) {
    const existingRule = await prisma.userExperienceRule.findFirst({
      where: { type: ruleData.type },
    })

    if (!existingRule) {
      await prisma.userExperienceRule.create({
        data: {
          type: ruleData.type,
          experience: ruleData.experience,
          dailyLimit: ruleData.dailyLimit ?? 0,
          isEnabled: ruleData.isEnabled,
          remark: ruleData.description,
          business: ruleData.business,
          eventKey: ruleData.eventKey ?? undefined,
        },
      })
    }
  }
}
