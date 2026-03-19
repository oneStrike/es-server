export interface UploadContentInput {
  chapterId: number
  workId: number
}

export interface UpdateComicContentInput {
  chapterId: number
  index: number
  content: string
}

export interface DeleteComicContentInput {
  chapterId: number
  index: number[]
}

export interface MoveComicContentInput {
  chapterId: number
  fromIndex: number
  toIndex: number
}
