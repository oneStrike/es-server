/**
 * forum section 写路径的 advisory lock 命名空间。
 * 用于串行化删板块、发帖等会争用同一 section 的写操作。
 */
export const FORUM_SECTION_MUTATION_LOCK_NAMESPACE = 42052
