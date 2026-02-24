import { WorkTypeEnum } from '@libs/base/constant'

interface IWorkData {
  name: string
  alias: string
  cover: string
  description: string
  language: string
  region: string
  ageRating: string
  serialStatus: number
  publisher: string
  originalSource: string
  copyright: string
  disclaimer: string
  isPublished: boolean
  publishAt: Date
  lastUpdated: Date
  viewCount: number
  favoriteCount: number
  likeCount: number
  rating: number | null
  ratingCount: number
  popularity: number
  isRecommended: boolean
  isHot: boolean
  isNew: boolean
  recommendWeight: number
  type: number
}

const COMIC_WORKS: IWorkData[] = [
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
    viewCount: 0,
    favoriteCount: 0,
    likeCount: 0,
    type: WorkTypeEnum.COMIC,
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
    viewCount: 0,
    favoriteCount: 0,
    likeCount: 0,
    type: WorkTypeEnum.COMIC,
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
    viewCount: 0,
    favoriteCount: 0,
    likeCount: 0,
    type: WorkTypeEnum.COMIC,
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
    viewCount: 0,
    favoriteCount: 0,
    likeCount: 0,
    type: WorkTypeEnum.COMIC,
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
    viewCount: 0,
    favoriteCount: 0,
    likeCount: 0,
    type: WorkTypeEnum.COMIC,
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
    viewCount: 0,
    favoriteCount: 0,
    likeCount: 0,
    type: WorkTypeEnum.COMIC,
  },
]

const NOVEL_WORKS: IWorkData[] = [
  {
    name: '挪威的森林',
    alias: 'Norwegian Wood,ノルウェイの森',
    cover: 'https://example.com/covers/norwegian-wood.jpg',
    popularity: 8800,
    language: 'ja-JP',
    region: 'JP',
    ageRating: 'R-18',
    isPublished: true,
    publishAt: new Date('2024-01-01'),
    lastUpdated: new Date(),
    description:
      '渡边彻在飞往德国汉堡的飞机上，听到披头士的《挪威的森林》，回忆起往事。那是他十八岁那年，在东京求学时与两位女性之间的故事...',
    publisher: '讲谈社',
    originalSource: '官方授权',
    serialStatus: 1,
    rating: 8.9,
    ratingCount: 8500,
    recommendWeight: 120,
    isRecommended: true,
    isHot: false,
    isNew: true,
    copyright: '© 村上春樹/講談社',
    disclaimer: '本作品仅供娱乐，不代表任何立场',
    viewCount: 0,
    favoriteCount: 0,
    likeCount: 0,
    type: WorkTypeEnum.NOVEL,
  },
  {
    name: '白夜行',
    alias: 'Journey Under the Midnight Sun,白夜行',
    cover: 'https://example.com/covers/journey-under-midnight-sun.jpg',
    popularity: 9100,
    language: 'ja-JP',
    region: 'JP',
    ageRating: 'R-15',
    isPublished: true,
    publishAt: new Date('2024-01-01'),
    lastUpdated: new Date(),
    description:
      '1973年，大阪的一栋废弃建筑中发现一名遭利器刺死的男子。警方怀疑一名叫西本雪穗的女孩，但最终因证据不足而无法起诉。此后十九年，雪穗与另一名男子桐原亮司的命运交织在一起...',
    publisher: '集英社',
    originalSource: '官方授权',
    serialStatus: 1,
    rating: 9.4,
    ratingCount: 12000,
    recommendWeight: 155,
    isRecommended: true,
    isHot: true,
    isNew: false,
    copyright: '© 東野圭吾/集英社',
    disclaimer: '本作品仅供娱乐，不代表任何立场',
    viewCount: 0,
    favoriteCount: 0,
    likeCount: 0,
    type: WorkTypeEnum.NOVEL,
  },
  {
    name: '嫌疑人X的献身',
    alias: 'The Devotion of Suspect X,容疑者Xの献身',
    cover: 'https://example.com/covers/suspect-x.jpg',
    popularity: 8700,
    language: 'ja-JP',
    region: 'JP',
    ageRating: 'R-15',
    isPublished: true,
    publishAt: new Date('2024-01-01'),
    lastUpdated: new Date(),
    description:
      '天才数学家石神哲哉每天早上都会经过固定的路线去上班，只为了在便当店看一眼邻居花冈靖子。某天，靖子失手杀死了纠缠不休的前夫，石神决定用他天才的头脑为她制造完美的不在场证明...',
    publisher: '文艺春秋',
    originalSource: '官方授权',
    serialStatus: 1,
    rating: 9.2,
    ratingCount: 9800,
    recommendWeight: 140,
    isRecommended: true,
    isHot: false,
    isNew: true,
    copyright: '© 東野圭吾/文藝春秋',
    disclaimer: '本作品仅供娱乐，不代表任何立场',
    viewCount: 0,
    favoriteCount: 0,
    likeCount: 0,
    type: WorkTypeEnum.NOVEL,
  },
]

export async function createInitialWorks(prisma: any) {
  const allWorks = [...COMIC_WORKS, ...NOVEL_WORKS]

  for (const item of allWorks) {
    const existingWork = await prisma.work.findFirst({
      where: { name: item.name },
    })

    if (!existingWork) {
      await prisma.work.create({
        data: item,
      })
    }
  }
}

export { COMIC_WORKS, NOVEL_WORKS }
