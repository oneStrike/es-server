interface IForumTagData {
  name: string
  description: string
  order: number
  isEnabled: boolean
  icon?: string
  useCount?: number
}

export async function createInitialForumTags(prisma: any) {
  const INITIAL_FORUM_TAGS: IForumTagData[] = [
    {
      name: 'JavaScript',
      description: 'JavaScript 相关讨论',
      order: 1,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',
      useCount: 0,
    },
    {
      name: 'TypeScript',
      description: 'TypeScript 相关讨论',
      order: 2,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
      useCount: 0,
    },
    {
      name: 'Node.js',
      description: 'Node.js 相关讨论',
      order: 3,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
      useCount: 0,
    },
    {
      name: 'React',
      description: 'React 相关讨论',
      order: 4,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg',
      useCount: 0,
    },
    {
      name: 'Vue',
      description: 'Vue 相关讨论',
      order: 5,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vuejs/vuejs-original.svg',
      useCount: 0,
    },
    {
      name: 'Angular',
      description: 'Angular 相关讨论',
      order: 6,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/angularjs/angularjs-original.svg',
      useCount: 0,
    },
    {
      name: 'Python',
      description: 'Python 相关讨论',
      order: 7,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
      useCount: 0,
    },
    {
      name: 'Java',
      description: 'Java 相关讨论',
      order: 8,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg',
      useCount: 0,
    },
    {
      name: 'Go',
      description: 'Go 相关讨论',
      order: 9,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original.svg',
      useCount: 0,
    },
    {
      name: 'Rust',
      description: 'Rust 相关讨论',
      order: 10,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-plain.svg',
      useCount: 0,
    },
  ]

  for (const tagData of INITIAL_FORUM_TAGS) {
    const existingTag = await prisma.forumTag.findFirst({
      where: { name: tagData.name },
    })

    if (!existingTag) {
      await prisma.forumTag.create({
        data: {
          name: tagData.name,
          icon: tagData.icon,
          useCount: tagData.useCount || 0,
          sortOrder: tagData.order,
          isEnabled: tagData.isEnabled,
          description: tagData.description,
        },
      })
    }
  }
}
