import process from 'node:process'
import { ScryptService } from '@libs/platform/modules/crypto/scrypt.service'

export const SEED_ADMIN_USERNAME =
  process.env.SEED_ADMIN_USERNAME?.trim() || 'admin'

export const SEED_ACCOUNT_PASSWORD = 'Seed@123456'

const SEED_READER_ACCOUNT_BASE_PREFIXES = [
  'tsuki',
  'ache',
  'dango',
  'minto',
  'nori',
  'yuzu',
  'sango',
  'ruri',
  'momo',
  'aoba',
  'kiri',
  'hina',
  'sora',
  'natsu',
  'shiro',
  'kuro',
] as const

const SEED_READER_ACCOUNT_BASE_SUFFIXES = [
  'note',
  'talk',
  'shelf',
  'loop',
  'cos',
  'zine',
] as const

export const SEED_READER_LEGACY_ACCOUNT_PREFIX = 'seed_reader_'

export const SEED_READER_ACCOUNT_SLUGS = [
  'tsukimi-komin',
  'ache-noknife',
  'dango-archive',
  ...SEED_READER_ACCOUNT_BASE_PREFIXES.flatMap((prefix) =>
    SEED_READER_ACCOUNT_BASE_SUFFIXES.map((suffix) => `${prefix}-${suffix}`),
  ).filter(
    (account) =>
      !['tsukimi-komin', 'ache-noknife', 'dango-archive'].includes(account),
  ),
].slice(0, 96)

const SEED_PASSWORD_SALT = 'seed-password-salt-v1'
const scryptService = new ScryptService()

// 生成 seed 账号入库密码哈希，明文只作为本地联调登录口令保留在 seed 层。
export async function createSeedPasswordHash() {
  return scryptService.encryptPassword(
    SEED_ACCOUNT_PASSWORD,
    SEED_PASSWORD_SALT,
  )
}

export const SEED_PLATFORM_ALL = [1, 2, 3]

export function createSeedReaderAccount(index: number) {
  const account = SEED_READER_ACCOUNT_SLUGS[index - 1]
  if (!account) {
    throw new Error(`seed reader account index out of range: ${index}`)
  }

  return account
}

export const SEED_ACCOUNTS = {
  readerA: createSeedReaderAccount(1),
  readerB: createSeedReaderAccount(2),
  readerC: createSeedReaderAccount(3),
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

export function asJsonText(
  value:
    | string
    | number
    | boolean
    | null
    | Record<string, string | number | boolean | null>
    | Array<string | number | boolean | null>,
) {
  return JSON.stringify(value)
}
