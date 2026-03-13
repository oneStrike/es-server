import { adminRelations } from './admin'
import { appRelations } from './app'
import { forumRelations } from './forum'
import { messageRelations } from './message'
import { systemRelations } from './system'
import { workRelations } from './work'

export const relations = {
  ...adminRelations,
  ...appRelations,
  ...forumRelations,
  ...messageRelations,
  ...systemRelations,
  ...workRelations,
}
