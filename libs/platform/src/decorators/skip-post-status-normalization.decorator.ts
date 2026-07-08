import { SetMetadata } from '@nestjs/common'

export const SKIP_POST_STATUS_NORMALIZATION_KEY =
  'skipPostStatusNormalization'

export const SkipPostStatusNormalization = () =>
  SetMetadata(SKIP_POST_STATUS_NORMALIZATION_KEY, true)
