/**
 * 作品成长规则种子数据
 *
 * 枚举值对照 (GrowthRuleTypeEnum):
 * - 100: 漫画浏览 (COMIC_WORK_VIEW)
 * - 101: 漫画点赞 (COMIC_WORK_LIKE)
 * - 102: 漫画收藏 (COMIC_WORK_FAVORITE)
 * - 200: 小说浏览 (NOVEL_WORK_VIEW)
 * - 201: 小说点赞 (NOVEL_WORK_LIKE)
 * - 202: 小说收藏 (NOVEL_WORK_FAVORITE)
 * - 300: 章节阅读 (COMIC_CHAPTER_READ)
 * - 301: 章节点赞 (COMIC_CHAPTER_LIKE)
 * - 302: 章节购买 (COMIC_CHAPTER_PURCHASE)
 * - 303: 章节下载 (COMIC_CHAPTER_DOWNLOAD)
 * - 304: 章节兑换 (COMIC_CHAPTER_EXCHANGE)
 */
export async function createInitialWorkGrowthRules(prisma: any) {
  const INITIAL_WORK_POINT_RULES = [
    // 漫画作品相关 (100-102)
    {
      description: '浏览漫画作品获得1积分，每日最多50次',
      type: 100, // COMIC_WORK_VIEW
      points: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.view',
    },
    {
      description: '点赞漫画作品获得2积分，每日最多50次',
      type: 101, // COMIC_WORK_LIKE
      points: 2,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.like',
    },
    {
      description: '收藏漫画作品获得3积分，每日最多20次',
      type: 102, // COMIC_WORK_FAVORITE
      points: 3,
      dailyLimit: 20,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.favorite',
    },
    // 小说作品相关 (200-202)
    {
      description: '浏览小说作品获得1积分，每日最多50次',
      type: 200, // NOVEL_WORK_VIEW
      points: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.novel.view',
    },
    {
      description: '点赞小说作品获得2积分，每日最多50次',
      type: 201, // NOVEL_WORK_LIKE
      points: 2,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.novel.like',
    },
    {
      description: '收藏小说作品获得3积分，每日最多20次',
      type: 202, // NOVEL_WORK_FAVORITE
      points: 3,
      dailyLimit: 20,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.novel.favorite',
    },
    // 漫画章节相关 (300-304)
    {
      description: '阅读漫画章节获得1积分，每日最多100次',
      type: 300, // COMIC_CHAPTER_READ
      points: 1,
      dailyLimit: 100,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.chapter.read',
    },
    {
      description: '点赞漫画章节获得1积分，每日最多50次',
      type: 301, // COMIC_CHAPTER_LIKE
      points: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.chapter.like',
    },
    {
      description: '购买漫画章节获得5积分，每日最多50次',
      type: 302, // COMIC_CHAPTER_PURCHASE
      points: 5,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.chapter.purchase',
    },
    {
      description: '下载漫画章节获得1积分，每日最多20次',
      type: 303, // COMIC_CHAPTER_DOWNLOAD
      points: 1,
      dailyLimit: 20,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.chapter.download',
    },
    {
      description: '兑换漫画章节消耗积分',
      type: 304, // COMIC_CHAPTER_EXCHANGE
      points: -10,
      dailyLimit: 0,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.chapter.exchange',
    },
  ]

  const INITIAL_WORK_EXPERIENCE_RULES = [
    // 漫画作品相关 (100-102)
    {
      name: '漫画浏览',
      description: '浏览漫画作品获得1点经验，每日最多50次',
      type: 100, // COMIC_WORK_VIEW
      experience: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.view',
    },
    {
      name: '漫画点赞',
      description: '点赞漫画作品获得2点经验，每日最多50次',
      type: 101, // COMIC_WORK_LIKE
      experience: 2,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.like',
    },
    {
      name: '漫画收藏',
      description: '收藏漫画作品获得3点经验，每日最多20次',
      type: 102, // COMIC_WORK_FAVORITE
      experience: 3,
      dailyLimit: 20,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.favorite',
    },
    // 小说作品相关 (200-202)
    {
      name: '小说浏览',
      description: '浏览小说作品获得1点经验，每日最多50次',
      type: 200, // NOVEL_WORK_VIEW
      experience: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.novel.view',
    },
    {
      name: '小说点赞',
      description: '点赞小说作品获得2点经验，每日最多50次',
      type: 201, // NOVEL_WORK_LIKE
      experience: 2,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.novel.like',
    },
    {
      name: '小说收藏',
      description: '收藏小说作品获得3点经验，每日最多20次',
      type: 202, // NOVEL_WORK_FAVORITE
      experience: 3,
      dailyLimit: 20,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.novel.favorite',
    },
    // 漫画章节相关 (300-304)
    {
      name: '章节阅读',
      description: '阅读漫画章节获得1点经验，每日最多100次',
      type: 300, // COMIC_CHAPTER_READ
      experience: 1,
      dailyLimit: 100,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.chapter.read',
    },
    {
      name: '章节点赞',
      description: '点赞漫画章节获得1点经验，每日最多50次',
      type: 301, // COMIC_CHAPTER_LIKE
      experience: 1,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.chapter.like',
    },
    {
      name: '章节购买',
      description: '购买漫画章节获得5点经验，每日最多50次',
      type: 302, // COMIC_CHAPTER_PURCHASE
      experience: 5,
      dailyLimit: 50,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.chapter.purchase',
    },
    {
      name: '章节下载',
      description: '下载漫画章节获得1点经验，每日最多20次',
      type: 303, // COMIC_CHAPTER_DOWNLOAD
      experience: 1,
      dailyLimit: 20,
      isEnabled: true,
      business: 'work',
      eventKey: 'work.comic.chapter.download',
    },
    {
      name: '章节兑换',
      description: '兑换漫画章节（仅积分，无经验）',
      type: 304, // COMIC_CHAPTER_EXCHANGE
      experience: 0,
      dailyLimit: 0,
      isEnabled: false,
      business: 'work',
      eventKey: 'work.comic.chapter.exchange',
    },
  ]

  for (const ruleData of INITIAL_WORK_POINT_RULES) {
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

  for (const ruleData of INITIAL_WORK_EXPERIENCE_RULES) {
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
