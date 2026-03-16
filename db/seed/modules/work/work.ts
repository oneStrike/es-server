import { eq, and } from 'drizzle-orm'
import type { Db } from '../../db-client'
import { work } from '../../../schema/work/work'
import { forumSection } from '../../../schema/forum/forum-section'
import { forumSectionGroup } from '../../../schema/forum/forum-section-group'

enum ContentTypeEnum {
  COMIC = 1,
  NOVEL = 2,
}

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
  publishAt: Date | null
  lastUpdated: Date | null
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
  viewRule?: number
  requiredViewLevelId?: number | null
  chapterPrice?: number
  canComment?: boolean
  commentCount?: number
  downloadCount?: number
}

const COMIC_WORKS: IWorkData[] = [
  {
    name: '进击的巨人',
    alias: 'Attack on Titan,進撃の巨人',
    cover: 'https://example.com/covers/attack-on-titan.jpg',
    popularity: 9500,
    language: 'ja',
    region: 'JP',
    ageRating: 'R15',
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
    type: ContentTypeEnum.COMIC,
  },
  {
    name: '海贼王',
    alias: 'One Piece,ワンピース',
    cover: 'https://example.com/covers/one-piece.jpg',
    popularity: 9800,
    language: 'ja',
    region: 'JP',
    ageRating: 'PG13',
    isPublished: true,
    publishAt: new Date('2024-01-01'),
    lastUpdated: new Date(),
    description:
      '拥有财富、名声、权力，这世界上的一切的男人 "海贼王" 哥尔·D·罗杰，在被行刑受死之前说了一句话，让全世界的人都涌向了大海。',
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
    type: ContentTypeEnum.COMIC,
  },
  {
    name: '鬼灭之刃',
    alias: 'Demon Slayer,鬼滅の刃',
    cover: 'https://example.com/covers/demon-slayer.jpg',
    popularity: 9200,
    language: 'ja',
    region: 'JP',
    ageRating: 'R15',
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
    type: ContentTypeEnum.COMIC,
  },
  {
    name: '你的名字',
    alias: 'Your Name,君の名は',
    cover: 'https://example.com/covers/your-name.jpg',
    popularity: 8500,
    language: 'ja',
    region: 'JP',
    ageRating: 'PG',
    isPublished: true,
    publishAt: new Date('2024-01-01'),
    lastUpdated: new Date(),
    description:
      '住在日本乡下的女高中生宫水三叶，和住在东京的男高中生立花泰树，两人在梦中交换了身体。',
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
    type: ContentTypeEnum.COMIC,
  },
]

const NOVEL_WORKS: IWorkData[] = [
  {
    name: '挪威的森林',
    alias: 'Norwegian Wood,ノルウェイの森',
    cover: 'https://example.com/covers/norwegian-wood.jpg',
    popularity: 8800,
    language: 'ja',
    region: 'JP',
    ageRating: 'R18',
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
    type: ContentTypeEnum.NOVEL,
  },
  {
    name: '白夜行',
    alias: 'Journey Under the Midnight Sun,白夜行',
    cover: 'https://example.com/covers/journey-under-midnight-sun.jpg',
    popularity: 9100,
    language: 'ja',
    region: 'JP',
    ageRating: 'R15',
    isPublished: true,
    publishAt: new Date('2024-01-01'),
    lastUpdated: new Date(),
    description:
      '1973年，大阪的一栋废弃建筑中发现一名遭利器刺死的男子。警方怀疑一名叫西本雪穗的女孩，但最终因证据不足而无法起诉。',
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
    type: ContentTypeEnum.NOVEL,
  },
]

export async function seedWorks(db: Db) {
  console.log('🌱 开始初始化作品数据...')

  const allWorks = [...COMIC_WORKS, ...NOVEL_WORKS]

  // 获取"经验分享"分组ID
  const sectionGroup = await db.query.forumSectionGroup.findFirst({
    where: eq(forumSectionGroup.name, '经验分享'),
  })

  const createdWorks: Array<{ id: number; name: string; forumSectionId: number | null }> = []

  for (const item of allWorks) {
    // 查找或创建论坛板块（与作品一对一关联）
    let section = await db.query.forumSection.findFirst({
      where: eq(forumSection.name, item.name),
    })

    if (section) {
      // 更新现有板块
      await db
        .update(forumSection)
        .set({
          description: item.description.slice(0, 500),
          isEnabled: item.isPublished,
          updatedAt: new Date(),
        })
        .where(eq(forumSection.id, section.id))
    } else {
      // 创建新板块
      const [newSection] = await db
        .insert(forumSection)
        .values({
          name: item.name,
          description: item.description.slice(0, 500),
          isEnabled: item.isPublished,
          groupId: sectionGroup?.id ?? null,
          sortOrder: 0,
          topicCount: 0,
          replyCount: 0,
          topicReviewPolicy: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: forumSection.id })

      section = newSection
    }

    // 查找或创建作品
    const existingWork = await db.query.work.findFirst({
      where: and(eq(work.name, item.name), eq(work.type, item.type)),
    })

    if (!existingWork) {
      const [created] = await db
        .insert(work)
        .values({
          ...item,
          forumSectionId: section?.id ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: work.id, name: work.name, forumSectionId: work.forumSectionId })

      createdWorks.push(created)
      console.log(`  ✓ 作品创建: ${item.name}`)
    } else {
      // 更新作品的 forumSectionId
      if (existingWork.forumSectionId !== section?.id) {
        await db
          .update(work)
          .set({
            forumSectionId: section?.id ?? null,
            updatedAt: new Date(),
          })
          .where(eq(work.id, existingWork.id))
      }
      createdWorks.push({
        id: existingWork.id,
        name: existingWork.name,
        forumSectionId: section?.id ?? null,
      })
      console.log(`  ℹ 作品已存在: ${item.name}`)
    }
  }

  console.log('✅ 作品数据初始化完成')
  return createdWorks
}

export { COMIC_WORKS, NOVEL_WORKS, ContentTypeEnum }
