import type { Db } from '../../db-client'
import { and, eq, isNull } from 'drizzle-orm'
import {
  appUserLevelRule,
  forumSection,
  forumSectionGroup,
  work,
  workAuthor,
  workAuthorRelation,
  workCategory,
  workCategoryRelation,
  workChapter,
  workComic,
  workNovel,
  workTag,
  workTagRelation,
} from '../../../schema'
import {
  addHours,
  createAvatar,
  DICTIONARY_ITEMS,
  SEED_TIMELINE,
} from '../../shared'

const WORK_SECTION_GROUP_NAME = '作品讨论'
const ADVANCED_LEVEL_NAME = '活跃读者'

const CATEGORY_FIXTURES = [
  {
    name: '热血',
    description: '强调成长、对抗与热血冒险',
    icon: 'https://static.example.com/categories/hot-blood.svg',
    contentType: [1, 2],
    sortOrder: 1,
    popularity: 120,
  },
  {
    name: '奇幻',
    description: '包含奇幻设定、超自然规则与异世界元素',
    icon: 'https://static.example.com/categories/fantasy.svg',
    contentType: [1, 2],
    sortOrder: 2,
    popularity: 100,
  },
  {
    name: '悬疑',
    description: '强调谜题、推理与心理张力',
    icon: 'https://static.example.com/categories/mystery.svg',
    contentType: [1, 2],
    sortOrder: 3,
    popularity: 110,
  },
  {
    name: '情感',
    description: '关注人物关系与情绪表达',
    icon: 'https://static.example.com/categories/emotion.svg',
    contentType: [1, 2],
    sortOrder: 4,
    popularity: 90,
  },
  {
    name: '现实',
    description: '基于现实生活经验的内容主题',
    icon: 'https://static.example.com/categories/realism.svg',
    contentType: [2],
    sortOrder: 5,
    popularity: 80,
  },
] as const

const TAG_FIXTURES = [
  {
    name: '高热度',
    description: '站内高讨论度内容',
    icon: 'https://static.example.com/tags/hot.svg',
    sortOrder: 1,
    popularity: 150,
  },
  {
    name: '动画改编',
    description: '有动画化或影视化内容',
    icon: 'https://static.example.com/tags/adaptation.svg',
    sortOrder: 2,
    popularity: 120,
  },
  {
    name: '长篇连载',
    description: '篇幅较长、世界观展开丰富',
    icon: 'https://static.example.com/tags/long-run.svg',
    sortOrder: 3,
    popularity: 90,
  },
  {
    name: '口碑佳作',
    description: '评分稳定、口碑较高的内容',
    icon: 'https://static.example.com/tags/recommended.svg',
    sortOrder: 4,
    popularity: 130,
  },
] as const

const AUTHOR_FIXTURES = [
  {
    name: '谏山创',
    avatar: createAvatar('isayama-hajime'),
    description: '以强叙事推进和压迫感见长的漫画作者。',
    nationality: DICTIONARY_ITEMS.nationality.jp,
    gender: 1,
    type: [1],
    isRecommended: true,
  },
  {
    name: '吾峠呼世晴',
    avatar: createAvatar('gotouge-koyoharu'),
    description: '以情绪表达和角色羁绊著称的漫画作者。',
    nationality: DICTIONARY_ITEMS.nationality.jp,
    gender: 2,
    type: [1],
    isRecommended: true,
  },
  {
    name: '村上春树',
    avatar: createAvatar('murakami-haruki'),
    description: '以现代都市情绪与个人记忆叙事闻名的作者。',
    nationality: DICTIONARY_ITEMS.nationality.jp,
    gender: 1,
    type: [2],
    isRecommended: true,
  },
  {
    name: '东野圭吾',
    avatar: createAvatar('keigo-higashino'),
    description: '以推理结构与人物命运并重见长的小说作者。',
    nationality: DICTIONARY_ITEMS.nationality.jp,
    gender: 1,
    type: [2],
    isRecommended: true,
  },
] as const

const WORK_FIXTURES = [
  {
    key: 'aot',
    name: '进击的巨人',
    alias: 'Attack on Titan,進撃の巨人',
    type: 1,
    cover: 'https://static.example.com/works/aot/cover.jpg',
    description:
      '围墙、人类与巨人的冲突被一点点翻开，设定和人物弧线都极具层次。',
    language: DICTIONARY_ITEMS.workLanguage.ja,
    region: DICTIONARY_ITEMS.workRegion.jp,
    ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: 2,
    publisher: DICTIONARY_ITEMS.workPublisher.kodansha,
    originalSource: 'official-license',
    copyright: '© 諫山創・講談社',
    disclaimer: 'seed 数据，仅用于联调。',
    isPublished: true,
    isRecommended: true,
    isHot: true,
    isNew: false,
    publishAt: '2026-03-01',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 1),
    viewRule: 1,
    requiredViewLevelName: null,
    chapterPrice: 30,
    canComment: true,
    recommendWeight: 9.6,
    popularity: 9800,
    rating: 9.3,
    categories: ['热血', '悬疑'],
    tags: ['高热度', '长篇连载'],
    authors: ['谏山创'],
    chapters: [
      {
        title: '第1话 致两千年后的你',
        subtitle: '开篇',
        sortOrder: 1,
        isPreview: true,
        isPublished: true,
        viewRule: 1,
        price: 0,
        content: '艾伦第一次意识到墙外世界与巨人的威胁。',
        wordCount: 1200,
      },
      {
        title: '第2话 那一天',
        subtitle: '风暴来袭',
        sortOrder: 2,
        isPreview: false,
        isPublished: true,
        viewRule: 3,
        price: 30,
        content: '城墙被破坏之后，角色命运开始转向。',
        wordCount: 1300,
      },
    ],
  },
  {
    key: 'demon-slayer',
    name: '鬼灭之刃',
    alias: 'Demon Slayer,鬼滅の刃',
    type: 1,
    cover: 'https://static.example.com/works/demon-slayer/cover.jpg',
    description: '以家庭羁绊和成长为核心，兼具强烈动作感和情绪张力。',
    language: DICTIONARY_ITEMS.workLanguage.ja,
    region: DICTIONARY_ITEMS.workRegion.jp,
    ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: 2,
    publisher: DICTIONARY_ITEMS.workPublisher.shueisha,
    originalSource: 'official-license',
    copyright: '© 吾峠呼世晴・集英社',
    disclaimer: 'seed 数据，仅用于联调。',
    isPublished: true,
    isRecommended: true,
    isHot: true,
    isNew: false,
    publishAt: '2026-03-01',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 2),
    viewRule: 1,
    requiredViewLevelName: null,
    chapterPrice: 28,
    canComment: true,
    recommendWeight: 9.2,
    popularity: 9600,
    rating: 9.1,
    categories: ['热血', '奇幻'],
    tags: ['高热度', '动画改编'],
    authors: ['吾峠呼世晴'],
    chapters: [
      {
        title: '第1话 残酷',
        subtitle: '雪夜',
        sortOrder: 1,
        isPreview: true,
        isPublished: true,
        viewRule: 1,
        price: 0,
        content: '炭治郎平静的生活被突如其来的惨剧打破。',
        wordCount: 1100,
      },
      {
        title: '第2话 培育师',
        subtitle: '启程',
        sortOrder: 2,
        isPreview: false,
        isPublished: true,
        viewRule: 3,
        price: 28,
        content: '鬼杀队修行真正开始，目标逐步明确。',
        wordCount: 1180,
      },
    ],
  },
  {
    key: 'norwegian-wood',
    name: '挪威的森林',
    alias: 'Norwegian Wood,ノルウェイの森',
    type: 2,
    cover: 'https://static.example.com/works/norwegian-wood/cover.jpg',
    description: '通过回忆与现实交错的方式展开人物关系与青春伤痕。',
    language: DICTIONARY_ITEMS.workLanguage.ja,
    region: DICTIONARY_ITEMS.workRegion.jp,
    ageRating: DICTIONARY_ITEMS.workAgeRating.r18,
    serialStatus: 2,
    publisher: DICTIONARY_ITEMS.workPublisher.shinchosha,
    originalSource: 'official-license',
    copyright: '© 村上春樹・新潮社',
    disclaimer: 'seed 数据，仅用于联调。',
    isPublished: true,
    isRecommended: true,
    isHot: false,
    isNew: true,
    publishAt: '2026-03-01',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 3),
    viewRule: 2,
    requiredViewLevelName: ADVANCED_LEVEL_NAME,
    chapterPrice: 22,
    canComment: true,
    recommendWeight: 8.8,
    popularity: 8600,
    rating: 8.8,
    categories: ['情感', '现实'],
    tags: ['口碑佳作'],
    authors: ['村上春树'],
    chapters: [
      {
        title: '第一章 飞行中的旋律',
        subtitle: '回忆的入口',
        sortOrder: 1,
        isPreview: true,
        isPublished: true,
        viewRule: 1,
        price: 0,
        content: '飞机上的旋律把渡边拉回旧日东京。',
        wordCount: 2100,
      },
      {
        title: '第二章 直子的来信',
        subtitle: '迟到的回答',
        sortOrder: 2,
        isPreview: false,
        isPublished: true,
        viewRule: 3,
        price: 22,
        content: '通过信件，人物之间未说出口的情绪被拉近。',
        wordCount: 2600,
      },
    ],
  },
  {
    key: 'journey-under-the-midnight-sun',
    name: '白夜行',
    alias: 'Journey Under the Midnight Sun,白夜行',
    type: 2,
    cover: 'https://static.example.com/works/byh/cover.jpg',
    description: '以案件脉络牵引人物命运，层层推进秘密与关系变化。',
    language: DICTIONARY_ITEMS.workLanguage.ja,
    region: DICTIONARY_ITEMS.workRegion.jp,
    ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: 2,
    publisher: DICTIONARY_ITEMS.workPublisher.shueisha,
    originalSource: 'official-license',
    copyright: '© 東野圭吾・集英社',
    disclaimer: 'seed 数据，仅用于联调。',
    isPublished: true,
    isRecommended: true,
    isHot: true,
    isNew: false,
    publishAt: '2026-03-01',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 4),
    viewRule: 2,
    requiredViewLevelName: ADVANCED_LEVEL_NAME,
    chapterPrice: 25,
    canComment: true,
    recommendWeight: 9.4,
    popularity: 9400,
    rating: 9.4,
    categories: ['悬疑', '现实'],
    tags: ['高热度', '口碑佳作'],
    authors: ['东野圭吾'],
    chapters: [
      {
        title: '第一章 案发之后',
        subtitle: '沉默的开端',
        sortOrder: 1,
        isPreview: true,
        isPublished: true,
        viewRule: 1,
        price: 0,
        content: '围绕旧案展开，人与案件都显得并不简单。',
        wordCount: 2400,
      },
      {
        title: '第二章 双线并进',
        subtitle: '更深的关系',
        sortOrder: 2,
        isPreview: false,
        isPublished: true,
        viewRule: 3,
        price: 25,
        content: '人物成长和悬疑线并行推进，信息量明显提升。',
        wordCount: 2800,
      },
    ],
  },
] as const

export async function seedWorkDomain(db: Db) {
  console.log('🌱 初始化作品域数据...')

  for (const categoryFixture of CATEGORY_FIXTURES) {
    const existing = await db.query.workCategory.findFirst({
      where: eq(workCategory.name, categoryFixture.name),
    })

    if (!existing) {
      await db.insert(workCategory).values({
        ...categoryFixture,
        contentType: [...categoryFixture.contentType],
        isEnabled: true,
      })
    } else {
      await db
        .update(workCategory)
        .set({
          ...categoryFixture,
          contentType: [...categoryFixture.contentType],
          isEnabled: true,
        })
        .where(eq(workCategory.id, existing.id))
    }
  }
  console.log('  ✓ 作品分类完成')

  for (const tagFixture of TAG_FIXTURES) {
    const existing = await db.query.workTag.findFirst({
      where: eq(workTag.name, tagFixture.name),
    })

    if (!existing) {
      await db.insert(workTag).values({
        ...tagFixture,
        isEnabled: true,
      })
    } else {
      await db
        .update(workTag)
        .set({
          ...tagFixture,
          isEnabled: true,
        })
        .where(eq(workTag.id, existing.id))
    }
  }
  console.log('  ✓ 作品标签完成')

  for (const authorFixture of AUTHOR_FIXTURES) {
    const existing = await db.query.workAuthor.findFirst({
      where: eq(workAuthor.name, authorFixture.name),
    })

    if (!existing) {
      await db.insert(workAuthor).values({
        ...authorFixture,
        type: [...authorFixture.type],
        isEnabled: true,
        remark: 'seed: 作者资料',
      })
    } else {
      await db
        .update(workAuthor)
        .set({
          ...authorFixture,
          type: [...authorFixture.type],
          isEnabled: true,
          remark: 'seed: 作者资料',
        })
        .where(eq(workAuthor.id, existing.id))
    }
  }
  console.log('  ✓ 作者完成')

  const workSectionGroup = await db.query.forumSectionGroup.findFirst({
    where: and(
      eq(forumSectionGroup.name, WORK_SECTION_GROUP_NAME),
      isNull(forumSectionGroup.deletedAt),
    ),
  })
  const advancedLevel = await db.query.appUserLevelRule.findFirst({
    where: eq(appUserLevelRule.name, ADVANCED_LEVEL_NAME),
  })

  for (const [index, workFixture] of WORK_FIXTURES.entries()) {
    let section = await db.query.forumSection.findFirst({
      where: and(
        eq(forumSection.name, workFixture.name),
        isNull(forumSection.deletedAt),
      ),
    })

    const sectionPayload = {
      groupId: workSectionGroup?.id ?? null,
      userLevelRuleId: null,
      name: workFixture.name,
      description: `${workFixture.name} 作品专属讨论板块`,
      icon: workFixture.cover,
      cover: workFixture.cover,
      sortOrder: index + 1,
      isEnabled: true,
      topicReviewPolicy: 1,
      remark: 'seed: 作品绑定论坛板块',
      topicCount: section?.topicCount ?? 0,
      commentCount: section?.commentCount ?? 0,
      lastPostAt: section?.lastPostAt ?? null,
      lastTopicId: section?.lastTopicId ?? null,
    }

    if (!section) {
      ;[section] = await db
        .insert(forumSection)
        .values(sectionPayload)
        .returning()
    } else {
      ;[section] = await db
        .update(forumSection)
        .set(sectionPayload)
        .where(eq(forumSection.id, section.id))
        .returning()
    }

    const existingWork = await db.query.work.findFirst({
      where: and(
        eq(work.name, workFixture.name),
        eq(work.type, workFixture.type),
      ),
    })

    const requiredLevelId =
      workFixture.requiredViewLevelName === ADVANCED_LEVEL_NAME
        ? (advancedLevel?.id ?? null)
        : null

    let currentWork = existingWork
    const workPayload = {
      type: workFixture.type,
      name: workFixture.name,
      alias: workFixture.alias,
      cover: workFixture.cover,
      description: workFixture.description,
      language: workFixture.language,
      region: workFixture.region,
      ageRating: workFixture.ageRating,
      serialStatus: workFixture.serialStatus,
      publisher: workFixture.publisher,
      originalSource: workFixture.originalSource,
      copyright: workFixture.copyright,
      disclaimer: workFixture.disclaimer,
      remark: 'seed: 作品基础信息',
      isPublished: workFixture.isPublished,
      isRecommended: workFixture.isRecommended,
      isHot: workFixture.isHot,
      isNew: workFixture.isNew,
      publishAt: workFixture.publishAt,
      lastUpdated: workFixture.lastUpdated,
      viewRule: workFixture.viewRule,
      requiredViewLevelId: requiredLevelId,
      forumSectionId: section.id,
      chapterPrice: workFixture.chapterPrice,
      canComment: workFixture.canComment,
      recommendWeight: workFixture.recommendWeight,
      viewCount: currentWork?.viewCount ?? 0,
      favoriteCount: currentWork?.favoriteCount ?? 0,
      likeCount: currentWork?.likeCount ?? 0,
      commentCount: currentWork?.commentCount ?? 0,
      downloadCount: currentWork?.downloadCount ?? 0,
      rating: workFixture.rating,
      popularity: workFixture.popularity,
    }

    if (!currentWork) {
      ;[currentWork] = await db.insert(work).values(workPayload).returning()
      console.log(`  ✓ 作品创建: ${currentWork.name}`)
    } else {
      ;[currentWork] = await db
        .update(work)
        .set(workPayload)
        .where(eq(work.id, currentWork.id))
        .returning()
      console.log(`  ↺ 作品更新: ${currentWork.name}`)
    }

    if (workFixture.type === 1) {
      const existingComic = await db.query.workComic.findFirst({
        where: eq(workComic.workId, currentWork.id),
      })

      if (!existingComic) {
        await db.insert(workComic).values({ workId: currentWork.id })
      } else {
        await db
          .update(workComic)
          .set({ workId: currentWork.id })
          .where(eq(workComic.id, existingComic.id))
      }
    } else {
      const totalWordCount = workFixture.chapters.reduce(
        (sum, chapter) => sum + chapter.wordCount,
        0,
      )
      const existingNovel = await db.query.workNovel.findFirst({
        where: eq(workNovel.workId, currentWork.id),
      })

      if (!existingNovel) {
        await db.insert(workNovel).values({
          workId: currentWork.id,
          wordCount: totalWordCount,
        })
      } else {
        await db
          .update(workNovel)
          .set({
            workId: currentWork.id,
            wordCount: totalWordCount,
          })
          .where(eq(workNovel.id, existingNovel.id))
      }
    }

    for (const [
      chapterIndex,
      chapterFixture,
    ] of workFixture.chapters.entries()) {
      const publishAt = addHours(
        SEED_TIMELINE.releaseDay,
        index * 6 + chapterIndex,
      )
      const existingChapter = await db.query.workChapter.findFirst({
        where: and(
          eq(workChapter.workId, currentWork.id),
          eq(workChapter.sortOrder, chapterFixture.sortOrder),
        ),
      })

      const chapterPayload = {
        workId: currentWork.id,
        workType: workFixture.type,
        title: chapterFixture.title,
        subtitle: chapterFixture.subtitle,
        cover: workFixture.cover,
        description: `${workFixture.name} ${chapterFixture.title}`,
        sortOrder: chapterFixture.sortOrder,
        isPublished: chapterFixture.isPublished,
        isPreview: chapterFixture.isPreview,
        publishAt,
        viewRule: chapterFixture.viewRule,
        requiredViewLevelId:
          chapterFixture.viewRule === 3
            ? requiredLevelId
            : null,
        price: chapterFixture.price,
        canDownload: true,
        canComment: true,
        content: chapterFixture.content,
        wordCount: chapterFixture.wordCount,
        viewCount: existingChapter?.viewCount ?? 0,
        likeCount: existingChapter?.likeCount ?? 0,
        commentCount: existingChapter?.commentCount ?? 0,
        purchaseCount: existingChapter?.purchaseCount ?? 0,
        downloadCount: existingChapter?.downloadCount ?? 0,
        remark: 'seed: 章节内容',
      }

      if (!existingChapter) {
        await db.insert(workChapter).values(chapterPayload)
      } else {
        await db
          .update(workChapter)
          .set(chapterPayload)
          .where(eq(workChapter.id, existingChapter.id))
      }
    }
  }
  console.log('  ✓ 作品与章节完成')

  for (const workFixture of WORK_FIXTURES) {
    const currentWork = await db.query.work.findFirst({
      where: and(
        eq(work.name, workFixture.name),
        eq(work.type, workFixture.type),
      ),
    })

    if (!currentWork) {
      continue
    }

    for (const [sortOrder, authorName] of workFixture.authors.entries()) {
      const author = await db.query.workAuthor.findFirst({
        where: eq(workAuthor.name, authorName),
      })
      if (!author) {
        continue
      }

      const existingRelation = await db.query.workAuthorRelation.findFirst({
        where: and(
          eq(workAuthorRelation.workId, currentWork.id),
          eq(workAuthorRelation.authorId, author.id),
        ),
      })

      if (!existingRelation) {
        await db.insert(workAuthorRelation).values({
          workId: currentWork.id,
          authorId: author.id,
          sortOrder,
        })
      } else {
        await db
          .update(workAuthorRelation)
          .set({
            sortOrder,
          })
          .where(
            and(
              eq(workAuthorRelation.workId, currentWork.id),
              eq(workAuthorRelation.authorId, author.id),
            ),
          )
      }
    }

    for (const [sortOrder, categoryName] of workFixture.categories.entries()) {
      const category = await db.query.workCategory.findFirst({
        where: eq(workCategory.name, categoryName),
      })
      if (!category) {
        continue
      }

      const existingRelation = await db.query.workCategoryRelation.findFirst({
        where: and(
          eq(workCategoryRelation.workId, currentWork.id),
          eq(workCategoryRelation.categoryId, category.id),
        ),
      })

      if (!existingRelation) {
        await db.insert(workCategoryRelation).values({
          workId: currentWork.id,
          categoryId: category.id,
          sortOrder,
        })
      } else {
        await db
          .update(workCategoryRelation)
          .set({ sortOrder })
          .where(
            and(
              eq(workCategoryRelation.workId, currentWork.id),
              eq(workCategoryRelation.categoryId, category.id),
            ),
          )
      }
    }

    for (const tagName of workFixture.tags) {
      const tag = await db.query.workTag.findFirst({
        where: eq(workTag.name, tagName),
      })
      if (!tag) {
        continue
      }

      const existingRelation = await db.query.workTagRelation.findFirst({
        where: and(
          eq(workTagRelation.workId, currentWork.id),
          eq(workTagRelation.tagId, tag.id),
        ),
      })

      if (!existingRelation) {
        await db.insert(workTagRelation).values({
          workId: currentWork.id,
          tagId: tag.id,
        })
      }
    }
  }
  console.log('  ✓ 作品关联完成')

  const authors = await db.query.workAuthor.findMany({
    where: isNull(workAuthor.deletedAt),
  })
  for (const author of authors) {
    const relations = await db.query.workAuthorRelation.findMany({
      where: eq(workAuthorRelation.authorId, author.id),
    })

    await db
      .update(workAuthor)
      .set({
        workCount: relations.length,
        followersCount: author.followersCount || relations.length * 12,
      })
      .where(eq(workAuthor.id, author.id))
  }
  console.log('  ✓ 作者统计完成')

  console.log('✅ 作品域数据完成')
}
