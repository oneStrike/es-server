export async function createInitialMediums(prisma: any) {
  const list = [
    { code: 'COMIC', name: '漫画' },
    { code: 'NOVEL', name: '小说' },
    { code: 'ILLUSTRATION', name: '插画' },
    { code: 'ALBUM', name: '图集' },
  ]
  for (const item of list) {
    await prisma.workContentType.upsert({
      where: { code: item.code },
      update: { name: item.name, isEnabled: true },
      create: { ...item, isEnabled: true },
    })
  }
}
