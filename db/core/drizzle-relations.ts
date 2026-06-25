import { adminRelations } from '../relations/admin'
import { appRelations } from '../relations/app'
import { forumRelations } from '../relations/forum'
import { messageRelations } from '../relations/message'
import { systemRelations } from '../relations/system'
import { workRelations } from '../relations/work'

export const relations = {
  ...adminRelations,
  ...appRelations,
  ...forumRelations,
  ...messageRelations,
  ...systemRelations,
  ...workRelations,
}
