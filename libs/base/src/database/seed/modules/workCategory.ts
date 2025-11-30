/**
 * 作品分类种子数据接口
 */
interface IWorkCategoryData {
  name: string
  mediumCodes: string[]
}

/**
 * 创建初始作品分类数据
 * @param prisma Prisma客户端实例
 */
export async function createInitialWorkCategory(prisma: any) {
  // 初始化作品分类数据
  const INITIAL_WORK_CATEGORIES: IWorkCategoryData[] = [
    { name: '百合', mediumCodes: ['COMIC', 'NOVEL', 'ILLUSTRATION', 'ALBUM'] },
    { name: '热血', mediumCodes: ['COMIC', 'NOVEL', 'ILLUSTRATION', 'ALBUM'] },
    { name: '温馨', mediumCodes: ['COMIC', 'NOVEL', 'ILLUSTRATION', 'ALBUM'] },
    { name: '校园', mediumCodes: ['COMIC', 'NOVEL', 'ILLUSTRATION', 'ALBUM'] },
    { name: '恋爱', mediumCodes: ['COMIC', 'NOVEL', 'ILLUSTRATION', 'ALBUM'] },
    { name: '冒险', mediumCodes: ['COMIC', 'NOVEL', 'ILLUSTRATION', 'ALBUM'] },
    { name: '科幻', mediumCodes: ['COMIC', 'NOVEL', 'ILLUSTRATION', 'ALBUM'] },
    { name: '悬疑', mediumCodes: ['COMIC', 'NOVEL', 'ILLUSTRATION', 'ALBUM'] },
  ]

  // 遍历初始数据，检查是否存在，不存在则创建
  for (const categoryData of INITIAL_WORK_CATEGORIES) {
    const existingCategory = await prisma.workCategory.findFirst({
      where: { name: categoryData.name },
    })

    if (!existingCategory) {
      const created = await prisma.workCategory.create({
        data: { name: categoryData.name },
      })
      // 绑定媒介类型（多对多）
      if (categoryData.mediumCodes?.length) {
        const mediums = await prisma.workContentType.findMany({
          where: { code: { in: categoryData.mediumCodes } },
          select: { id: true, code: true },
        })
        if (mediums.length) {
          await prisma.workCategoryContentType.createMany({
            data: mediums.map((m: any) => ({
              categoryId: created.id,
              contentTypeId: m.id,
            })),
            skipDuplicates: true,
          })
        }
      }
    }
  }
}
