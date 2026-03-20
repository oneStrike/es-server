export const SEED_PASSWORD_HASH =
  'e54d37047759e69ae2ffd34850ce3281.0275adf4e59d2e4e5d64f8694e327a0e8960a81bcecde7b47eaf3d76878f50b1b8ec520eb1bc0171336ec0dfb07f78611672be9fa335e1834cff45ebb68a98ac'

export const SEED_ADMIN_USERNAME = 'admin'

export const SEED_PLATFORM_ALL = [1, 2]

export const SEED_ACCOUNTS = {
  readerA: 'seed_reader_001',
  readerB: 'seed_reader_002',
  readerC: 'seed_reader_003',
} as const

export const SEED_TIMELINE = {
  seedAt: new Date('2026-03-20T08:00:00.000Z'),
  previousDay: new Date('2026-03-19T08:00:00.000Z'),
  releaseDay: new Date('2026-03-01T08:00:00.000Z'),
  chatBucket: new Date('2026-03-20T08:30:00.000Z'),
} as const

export const DICTIONARY_CODES = {
  workLanguage: 'work_language',
  nationality: 'nationality',
  workRegion: 'work_region',
  workPublisher: 'work_publisher',
  workAgeRating: 'work_age_rating',
} as const

export const DICTIONARY_ITEMS = {
  workLanguage: {
    zh: 'zh',
    ja: 'ja',
    en: 'en',
  },
  nationality: {
    cn: 'CN',
    jp: 'JP',
    kr: 'KR',
  },
  workRegion: {
    cn: 'CN',
    jp: 'JP',
    kr: 'KR',
  },
  workPublisher: {
    kodansha: 'kodansha',
    shueisha: 'shueisha',
    kadokawa: 'kadokawa',
    shinchosha: 'shinchosha',
  },
  workAgeRating: {
    all: 'ALL',
    pg13: 'PG13',
    r15: 'R15',
    r18: 'R18',
  },
} as const

export function createAvatar(seed: string) {
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}`
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

export function asJsonText(value: unknown) {
  return JSON.stringify(value)
}
