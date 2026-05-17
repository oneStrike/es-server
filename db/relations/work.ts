import { defineRelationsPart } from 'drizzle-orm'
import * as schema from '../schema'

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
    contentImportJobs: r.many.contentImportJob({
      from: r.work.id,
      to: r.contentImportJob.workId,
    }),
    thirdPartySourceBinding: r.one.workThirdPartySourceBinding({
      from: r.work.id,
      to: r.workThirdPartySourceBinding.workId,
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
  contentImportJob: {
    workflowJob: r.one.workflowJob({
      from: r.contentImportJob.workflowJobId,
      to: r.workflowJob.id,
    }),
    work: r.one.work({
      from: r.contentImportJob.workId,
      to: r.work.id,
    }),
    previewItems: r.many.contentImportPreviewItem({
      from: r.contentImportJob.id,
      to: r.contentImportPreviewItem.contentImportJobId,
    }),
    items: r.many.contentImportItem({
      from: r.contentImportJob.id,
      to: r.contentImportItem.contentImportJobId,
    }),
    eventLinks: r.many.contentImportEventLink({
      from: r.contentImportJob.id,
      to: r.contentImportEventLink.contentImportJobId,
    }),
  },
  contentImportPreviewItem: {
    job: r.one.contentImportJob({
      from: r.contentImportPreviewItem.contentImportJobId,
      to: r.contentImportJob.id,
    }),
  },
  contentImportItem: {
    job: r.one.contentImportJob({
      from: r.contentImportItem.contentImportJobId,
      to: r.contentImportJob.id,
    }),
    attempts: r.many.contentImportItemAttempt({
      from: r.contentImportItem.id,
      to: r.contentImportItemAttempt.contentImportItemId,
    }),
    eventLinks: r.many.contentImportEventLink({
      from: r.contentImportItem.id,
      to: r.contentImportEventLink.contentImportItemId,
    }),
  },
  contentImportItemAttempt: {
    workflowAttempt: r.one.workflowAttempt({
      from: r.contentImportItemAttempt.workflowAttemptId,
      to: r.workflowAttempt.id,
    }),
    item: r.one.contentImportItem({
      from: r.contentImportItemAttempt.contentImportItemId,
      to: r.contentImportItem.id,
    }),
    eventLinks: r.many.contentImportEventLink({
      from: r.contentImportItemAttempt.id,
      to: r.contentImportEventLink.contentImportItemAttemptId,
    }),
  },
  contentImportEventLink: {
    workflowEvent: r.one.workflowEvent({
      from: r.contentImportEventLink.workflowEventId,
      to: r.workflowEvent.id,
    }),
    job: r.one.contentImportJob({
      from: r.contentImportEventLink.contentImportJobId,
      to: r.contentImportJob.id,
    }),
    item: r.one.contentImportItem({
      from: r.contentImportEventLink.contentImportItemId,
      to: r.contentImportItem.id,
    }),
    itemAttempt: r.one.contentImportItemAttempt({
      from: r.contentImportEventLink.contentImportItemAttemptId,
      to: r.contentImportItemAttempt.id,
    }),
  },
  workThirdPartySourceBinding: {
    work: r.one.work({
      from: r.workThirdPartySourceBinding.workId,
      to: r.work.id,
    }),
    chapterBindings: r.many.workThirdPartyChapterBinding({
      from: r.workThirdPartySourceBinding.id,
      to: r.workThirdPartyChapterBinding.workThirdPartySourceBindingId,
    }),
  },
  workThirdPartyChapterBinding: {
    sourceBinding: r.one.workThirdPartySourceBinding({
      from: r.workThirdPartyChapterBinding.workThirdPartySourceBindingId,
      to: r.workThirdPartySourceBinding.id,
    }),
    chapter: r.one.workChapter({
      from: r.workThirdPartyChapterBinding.chapterId,
      to: r.workChapter.id,
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
