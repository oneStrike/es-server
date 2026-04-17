import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')
const remoteDeployScript = fs.readFileSync(
  path.join(repoRoot, 'scripts/auto-deploy.sh'),
  'utf8',
)
const localDeployScript = fs.readFileSync(
  path.join(repoRoot, 'scripts/auto-deploy-local.sh'),
  'utf8',
)

describe('auto deploy governance regressions', () => {
  it('uses fetch + reset instead of stash + pull in the remote deploy script', () => {
    expect(remoteDeployScript).toMatch(/reset --hard "origin\/\$\{CURRENT_BRANCH\}"/)
    expect(remoteDeployScript).not.toContain('git stash save')
    expect(remoteDeployScript).not.toContain('stash_changes')
    expect(remoteDeployScript).not.toContain('cleanup_stash_for_dir')
    expect(remoteDeployScript).not.toContain('git_with_retry pull origin "${CURRENT_BRANCH}"')
  })

  it('deploys server before both frontends by default', () => {
    expect(remoteDeployScript).toContain('PROJECTS=("es-server" "es-admin" "es-app-v2")')
    expect(localDeployScript).toContain('for project in es-server es-admin es-app-v2; do')
  })

  it('only refreshes frontend proxies after server deploy when no frontend deploy remains', () => {
    expect(remoteDeployScript).toContain('should_refresh_frontend_after_server_deploy')
    expect(remoteDeployScript).toContain('PENDING_PROJECTS')
    expect(localDeployScript).toContain('should_refresh_frontend_after_server_deploy')
  })
})
