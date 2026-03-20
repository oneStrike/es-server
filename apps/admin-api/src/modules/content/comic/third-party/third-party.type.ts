/**
 * 第三方漫画搜索入参。
 * 用于指定平台、关键词与分页参数。
 */
export interface SearchComicRequestInput {
  pageIndex?: number
  pageSize?: number
  orderBy?: string
  keyword: string
  platform: string
}

/**
 * 第三方漫画详情入参。
 * 用于指定平台与目标漫画 id。
 */
export interface DetailComicRequestInput {
  platform: string
  comicId: string
}

/**
 * 第三方漫画章节内容入参。
 * 用于指定平台、漫画 id 与章节 id。
 */
export interface ChapterContentComicRequestInput
  extends DetailComicRequestInput {
  chapterId: string
}
