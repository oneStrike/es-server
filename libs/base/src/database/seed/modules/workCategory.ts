// 修改 libs/base/src/database/seed/modules/workCategory.ts 文件

/**
 * 创建初始作品分类数据
 * @param prisma Prisma客户端实例
 */
export async function createInitialWorkCategory(prisma: any) {
  // 初始化作品分类数据
  const initData = [
    { name: '百合', contentType: [1, 2, 4, 8] },
    { name: '热血', contentType: [1, 2, 4, 8] },
    { name: '温馨', contentType: [1, 2, 4, 8] },
    { name: '校园', contentType: [1, 2, 4, 8] },
    { name: '恋爱', contentType: [1, 2, 4, 8] },
    { name: '冒险', contentType: [1, 2, 4, 8] },
    { name: '科幻', contentType: [1, 2, 4, 8] },
    { name: '悬疑', contentType: [1, 2, 4, 8] },
  ]

  for (const item of initData) {
    // 由于没有唯一约束，我们使用name作为判断条件
    const existingCategory = await prisma.workCategory.findFirst({
      where: { name: item.name },
    })

    if (!existingCategory) {
      await prisma.workCategory.create({
        data: item,
      })
    } else {
      // 更新已存在的分类
      await prisma.workCategory.update({
        where: { id: existingCategory.id },
        data: item,
      })
    }
  }
}
