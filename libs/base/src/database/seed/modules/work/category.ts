export async function createInitialWorkCategory(prisma: any) {
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
    const existingCategory = await prisma.workCategory.findFirst({
      where: { name: item.name },
    })

    if (!existingCategory) {
      await prisma.workCategory.create({
        data: item,
      })
    } else {
      await prisma.workCategory.update({
        where: { id: existingCategory.id },
        data: item,
      })
    }
  }
}
