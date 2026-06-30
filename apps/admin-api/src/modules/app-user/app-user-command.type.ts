import type { AppUserInsert } from '@db/schema'

/** 管理端 APP 用户资料更新入参，按 DTO 可选字段裁剪 schema 写入字段。 */
export type AppUserProfileUpdateInput = Partial<
  Pick<
    AppUserInsert,
    | 'nickname'
    | 'avatarUrl'
    | 'profileBackgroundImageUrl'
    | 'phoneNumber'
    | 'emailAddress'
    | 'genderType'
    | 'birthDate'
    | 'signature'
    | 'bio'
  >
>
