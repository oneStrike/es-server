interface IForumTagData {
  name: string
  description: string
  order: number
  isEnabled: boolean
  icon?: string
}

export async function createInitialForumTags(prisma: any) {
  const INITIAL_FORUM_TAGS: IForumTagData[] = [
    {
      name: 'JavaScript',
      description: 'JavaScript 相关讨论',
      order: 1,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',
    },
    {
      name: 'TypeScript',
      description: 'TypeScript 相关讨论',
      order: 2,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
    },
    {
      name: 'Node.js',
      description: 'Node.js 相关讨论',
      order: 3,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
    },
    {
      name: 'React',
      description: 'React 相关讨论',
      order: 4,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg',
    },
    {
      name: 'Vue',
      description: 'Vue 相关讨论',
      order: 5,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vuejs/vuejs-original.svg',
    },
    {
      name: 'Angular',
      description: 'Angular 相关讨论',
      order: 6,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/angularjs/angularjs-original.svg',
    },
    {
      name: 'Python',
      description: 'Python 相关讨论',
      order: 7,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
    },
    {
      name: 'Java',
      description: 'Java 相关讨论',
      order: 8,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg',
    },
    {
      name: 'Go',
      description: 'Go 相关讨论',
      order: 9,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original.svg',
    },
    {
      name: 'Rust',
      description: 'Rust 相关讨论',
      order: 10,
      isEnabled: true,
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-plain.svg',
    },
  ]

  for (const tagData of INITIAL_FORUM_TAGS) {
    const existingTag = await prisma.forumTag.findFirst({
      where: { name: tagData.name },
    })

    if (!existingTag) {
      await prisma.forumTag.create({
        data: tagData,
      })
    }
  }
}
