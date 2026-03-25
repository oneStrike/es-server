const BACKSLASH_REGEX = /\\/g
const PERCENT_REGEX = /%/g
const UNDERSCORE_REGEX = /_/g

export function escapeLikePattern(input: string): string {
  return input
    .replace(BACKSLASH_REGEX, '\\\\')
    .replace(PERCENT_REGEX, '\\%')
    .replace(UNDERSCORE_REGEX, '\\_')
}
