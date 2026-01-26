# Seed Update Alignment

## Project Context
The project uses Prisma for database management and has a seed mechanism located in `libs/base/src/database/seed`. The database schema has recently undergone significant changes, and the existing seed files need to be adjusted to match the new schema.

## Requirements
- Analyze the latest Prisma schema definitions in `prisma/models/`.
- Review existing seed files in `libs/base/src/database/seed/modules/`.
- Identify discrepancies between the schema and seed data.
- Update seed files to ensure they are compatible with the new schema.
- Verify that the seeds run successfully.

## Analysis Strategy
I will analyze the modules in the following order:
1.  **Admin & System**: `admin-user`, `dictionary`
2.  **Work**: `work-category`, `work-tag`, `author`, `comic` related tables.
3.  **App**: `app-config`, `app-page`, `app-notice`, `client-user`
4.  **Forum**: `forum-config`, `forum-section`, `forum-tag`, `forum-badge`, `point-rule`, `experience-rule`, `level-rule`, `sensitive-word`, `forum-profile`

## Identified Issues (To be filled during analysis)

### Admin Module
- [ ] Check `AdminUser` schema vs `admin-account.ts`

### System Module
- [ ] Check `Dictionary` schema vs `dictionary.ts`

### Work Module
- [ ] Check `WorkCategory` vs `category.ts`
- [ ] Check `WorkTag` vs `tag.ts`
- [ ] Check `WorkAuthor` vs `author.ts`
- [ ] Check `WorkComic` vs `index.ts` (comics)
- [ ] Check relationships

### App Module
- [ ] Check `AppConfig` vs `config.ts`
- [ ] Check `AppPage` vs `page.ts`
- [ ] Check `AppNotice` vs `notice.ts`
- [ ] Check `AppUser` vs `client-user.ts`

### Forum Module
- [ ] Check `ForumConfig` vs `config.ts`
- [ ] Check `ForumSectionGroup` vs `section-group.ts`
- [ ] Check `ForumSection` vs `section.ts`
- [ ] Check `ForumTag` vs `tag.ts`
- [ ] Check `ForumBadge` vs `badge.ts`
- [ ] Check `AppPointRule` vs `point-rule.ts`
- [ ] Check `AppExperienceRule` vs `experience-rule.ts`
- [ ] Check `AppLevelRule` vs `level-rule.ts`
- [ ] Check `ForumSensitiveWord` vs `sensitive-word.ts`
- [ ] Check `ForumProfile` vs `forum-profile.ts`

## Questions
- Are there any new required fields that don't have default values?
- Are there any removed fields that are still referenced in seeds?
- Are there any type changes?
