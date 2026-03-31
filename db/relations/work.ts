import { defineRelationsPart } from 'drizzle-orm'
import * as schema from '../schema/index'

export const workRelations = defineRelationsPart(schema, (r) => ({
  work: {
    comic: r.one.workComic({
      from: r.work.id,
      to: r.workComic.workId,
    }),
    novel: r.one.workNovel({
      from: r.work.id,
      to: r.workNovel.workId,
    }),
    authorRelations: r.many.workAuthorRelation(),
    authors: r.many.workAuthor({
      from: r.work.id.through(r.workAuthorRelation.workId),
      to: r.workAuthor.id.through(r.workAuthorRelation.authorId),
    }),
    categoryRelations: r.many.workCategoryRelation(),
    categories: r.many.workCategory({
      from: r.work.id.through(r.workCategoryRelation.workId),
      to: r.workCategory.id.through(r.workCategoryRelation.categoryId),
    }),
    tagRelations: r.many.workTagRelation(),
    tags: r.many.workTag({
      from: r.work.id.through(r.workTagRelation.workId),
      to: r.workTag.id.through(r.workTagRelation.tagId),
    }),
    chapters: r.many.workChapter(),
    comicArchiveImportTasks: r.many.workComicArchiveImportTask({
      from: r.work.id,
      to: r.workComicArchiveImportTask.workId,
    }),
    userReadingStates: r.many.userWorkReadingState({
      from: r.work.id,
      to: r.userWorkReadingState.workId,
    }),
    requiredViewLevel: r.one.userLevelRule({
      from: r.work.requiredViewLevelId,
      to: r.userLevelRule.id,
      alias: 'WorkViewLevel',
    }),
    forumSection: r.one.forumSection({
      from: r.work.forumSectionId,
      to: r.forumSection.id,
    }),
  },
  workAuthor: {
    workRelations: r.many.workAuthorRelation(),
    works: r.many.work({
      from: r.workAuthor.id.through(r.workAuthorRelation.authorId),
      to: r.work.id.through(r.workAuthorRelation.workId),
    }),
  },
  workAuthorRelation: {
    work: r.one.work({ from: r.workAuthorRelation.workId, to: r.work.id }),
    author: r.one.workAuthor({
      from: r.workAuthorRelation.authorId,
      to: r.workAuthor.id,
    }),
  },
  workCategory: {
    workRelations: r.many.workCategoryRelation(),
    works: r.many.work({
      from: r.workCategory.id.through(r.workCategoryRelation.categoryId),
      to: r.work.id.through(r.workCategoryRelation.workId),
    }),
  },
  workCategoryRelation: {
    work: r.one.work({ from: r.workCategoryRelation.workId, to: r.work.id }),
    category: r.one.workCategory({
      from: r.workCategoryRelation.categoryId,
      to: r.workCategory.id,
    }),
  },
  workChapter: {
    work: r.one.work({ from: r.workChapter.workId, to: r.work.id }),
    requiredViewLevel: r.one.userLevelRule({
      from: r.workChapter.requiredViewLevelId,
      to: r.userLevelRule.id,
      alias: 'ChapterReadLevel',
    }),
    readingStates: r.many.userWorkReadingState({
      from: r.workChapter.id,
      to: r.userWorkReadingState.lastReadChapterId,
      alias: 'UserWorkReadingStateLastReadChapter',
    }),
  },
  workComicArchiveImportTask: {
    work: r.one.work({
      from: r.workComicArchiveImportTask.workId,
      to: r.work.id,
    }),
  },
  workComic: {
    work: r.one.work({ from: r.workComic.workId, to: r.work.id }),
  },
  workNovel: {
    work: r.one.work({ from: r.workNovel.workId, to: r.work.id }),
  },
  workTag: {
    workRelations: r.many.workTagRelation(),
    works: r.many.work({
      from: r.workTag.id.through(r.workTagRelation.tagId),
      to: r.work.id.through(r.workTagRelation.workId),
    }),
  },
  workTagRelation: {
    work: r.one.work({ from: r.workTagRelation.workId, to: r.work.id }),
    tag: r.one.workTag({ from: r.workTagRelation.tagId, to: r.workTag.id }),
  },
}))
