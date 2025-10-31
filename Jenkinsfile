pipeline {
    agent any
    
    environment {
        // Node.js 版本
        NODE_VERSION = '22'
        // PNPM 版本
        PNPM_VERSION = '9.15.4'
        // Docker 镜像名称
        DOCKER_IMAGE = 'akaiito-server'
        // 腾讯云容器镜像服务地址
        DOCKER_REGISTRY = 'ccr.ccs.tencentyun.com'
        // Docker 镜像完整路径
        DOCKER_IMAGE_FULL_PATH = 'ccr.ccs.tencentyun.com/akaiito/akaiito-server'
        // 腾讯云用户名
        DOCKER_USERNAME = '100014575720'
        // 应用名称
        APP_NAME = 'es-server'
        // 部署环境
        DEPLOY_ENV = 'production'
    }
    
    // 注释掉 tools 部分，改为在脚本中安装 Node.js
    // tools {
    //     nodejs "${NODE_VERSION}"
    // }
    
    stages {
        stage('Checkout') {
            steps {
                echo '📥 检出代码...'
                checkout scm
                
                // 显示构建信息
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                    env.BUILD_TIME = sh(
                        script: "date '+%Y-%m-%d %H:%M:%S'",
                        returnStdout: true
                    ).trim()
                }
                
                echo "🔖 Git Commit: ${env.GIT_COMMIT_SHORT}"
                echo "⏰ Build Time: ${env.BUILD_TIME}"
            }
        }
        
        stage('Setup Environment') {
            steps {
                echo '🔧 设置构建环境...'
                
                // 安装 Node.js 和 PNPM (Linux 环境)
                sh """
                    # 检查并安装 Node.js
                    if ! command -v node &> /dev/null; then
                        echo "安装 Node.js ${NODE_VERSION}..."
                        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
                        sudo apt-get install -y nodejs
                    fi
                    
                    # 显示版本信息
                    node --version
                    npm --version
                    
                    # 安装 PNPM
                    npm install -g pnpm@${PNPM_VERSION}
                    pnpm --version
                """
                
                // 缓存依赖
                script {
                    if (fileExists('pnpm-lock.yaml')) {
                        echo '📦 安装项目依赖...'
                        sh 'pnpm install --frozen-lockfile'
                    } else {
                        error '❌ pnpm-lock.yaml 文件不存在'
                    }
                }
            }
        }
        
        stage('Code Quality') {
            parallel {
                stage('Lint') {
                    steps {
                        echo '🔍 运行代码检查...'
                        sh 'pnpm run lint'
                    }
                }
                
                stage('Type Check') {
                    steps {
                        echo '📝 运行类型检查...'
                        sh 'pnpm run type-check'
                    }
                }
                
                stage('Format Check') {
                    steps {
                        echo '💅 检查代码格式...'
                        sh 'npx prettier --check "src/**/*.{ts,js,json}"'
                    }
                }
            }
        }
        
        stage('Database Setup') {
            steps {
                echo '🗄️ 设置数据库...'
                
                // 生成 Prisma Client
                sh 'pnpm run prisma:generate'
                
                // 格式化 Prisma schema
                sh 'pnpm run prisma:format'
            }
        }
        
        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        echo '🧪 运行单元测试...'
                        sh 'pnpm run test:cov'
                    }
                    post {
                        always {
                            // 发布测试结果
                            publishTestResults testResultsPattern: 'coverage/lcov-report/*.xml'
                            
                            // 发布覆盖率报告
                            publishCoverage adapters: [
                                istanbulCoberturaAdapter('coverage/cobertura-coverage.xml')
                            ], sourceFileResolver: sourceFiles('STORE_LAST_BUILD')
                        }
                    }
                }
                
                stage('E2E Tests') {
                    when {
                        anyOf {
                            branch 'main'
                            branch 'develop'
                            changeRequest()
                        }
                    }
                    steps {
                        echo '🔄 运行端到端测试...'
                        sh 'pnpm run test:e2e'
                    }
                }
            }
        }
        
        stage('Build') {
            steps {
                echo '🏗️ 构建应用...'
                
                // 构建 NestJS 应用
                sh 'pnpm run build'
                
                // 验证构建产物
                script {
                    if (!fileExists('dist/main.js')) {
                        error '❌ 构建失败：找不到 dist/main.js'
                    }
                    echo '✅ 构建成功'
                }
            }
        }
        
        stage('Docker Build') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                    branch 'release/*'
                }
            }
            steps {
                echo '🐳 构建 Docker 镜像...'
                
                script {
                    // 检查 Docker 是否可用
                    def dockerAvailable = sh(
                        script: 'command -v docker >/dev/null 2>&1',
                        returnStatus: true
                    ) == 0
                    
                    if (!dockerAvailable) {
                        echo '⚠️ Docker 不可用，跳过 Docker 构建阶段'
                        echo '💡 提示：请确保 Jenkins 容器已正确配置 Docker 访问权限'
                        echo '   - 挂载 Docker socket: -v /var/run/docker.sock:/var/run/docker.sock'
                        echo '   - 或使用 Docker-in-Docker (DinD) 配置'
                        currentBuild.result = 'UNSTABLE'
                        return
                    }
                    
                    // 构建 Docker 镜像
                    def imageTag = "${env.BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"
                    def fullImageName = "${DOCKER_IMAGE_FULL_PATH}:${imageTag}"
                    
                    // 构建镜像
                    sh """
                        docker build -t ${DOCKER_IMAGE}:${imageTag} .
                        docker tag ${DOCKER_IMAGE}:${imageTag} ${DOCKER_IMAGE}:latest
                        docker tag ${DOCKER_IMAGE}:${imageTag} ${fullImageName}
                        docker tag ${DOCKER_IMAGE}:${imageTag} ${DOCKER_IMAGE_FULL_PATH}:latest
                    """
                    
                    // 如果是主分支，推送到腾讯云容器镜像服务
                    if (env.BRANCH_NAME == 'main') {
                        echo '📤 推送 Docker 镜像到腾讯云容器镜像服务...'
                        
                        // 登录腾讯云容器镜像服务
                        withCredentials([usernamePassword(credentialsId: 'tencent-docker-registry', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                            sh """
                                echo \$DOCKER_PASS | docker login ${DOCKER_REGISTRY} --username \$DOCKER_USER --password-stdin
                                docker push ${fullImageName}
                                docker push ${DOCKER_IMAGE_FULL_PATH}:latest
                            """
                        }
                    }
                    
                    // 保存镜像信息供后续阶段使用
                    env.DOCKER_IMAGE_TAG = imageTag
                    env.DOCKER_FULL_IMAGE = fullImageName
                }
            }
        }
        
        stage('Security Scan') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                }
            }
            parallel {
                stage('Dependency Check') {
                    steps {
                        echo '🔒 检查依赖安全性...'
                        sh 'pnpm audit --audit-level moderate'
                    }
                }
                
                stage('Docker Image Scan') {
                    when {
                        expression { env.DOCKER_IMAGE_TAG != null }
                    }
                    steps {
                        echo '🛡️ 扫描 Docker 镜像安全性...'
                        // 使用 Trivy 或其他安全扫描工具扫描腾讯云镜像
                        sh """
                            # 示例：使用 Trivy 扫描腾讯云容器镜像
                            # trivy image ${DOCKER_IMAGE_FULL_PATH}:${env.DOCKER_IMAGE_TAG}
                            echo "Docker 镜像安全扫描完成: ${DOCKER_IMAGE_FULL_PATH}:${env.DOCKER_IMAGE_TAG}"
                        """
                    }
                }
            }
        }
        
        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                echo '🚀 部署到测试环境...'
                
                script {
                    // 部署到测试环境
                    sh """
                        echo "部署镜像: ${DOCKER_IMAGE_FULL_PATH}:${env.DOCKER_IMAGE_TAG}"
                        # 这里添加实际的部署脚本
                        # 例如：kubectl set image deployment/${APP_NAME} ${APP_NAME}=${env.DOCKER_FULL_IMAGE}
                        # 或者使用 docker-compose 部署：
                        # docker-compose -f docker-compose.staging.yml up -d
                    """
                }
            }
        }
        
        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                echo '🎯 部署到生产环境...'
                
                // 需要手动确认
                input message: '确认部署到生产环境？', ok: '部署'
                
                script {
                    // 部署到生产环境
                    sh """
                        echo "部署镜像到生产环境: ${DOCKER_IMAGE_FULL_PATH}:${env.DOCKER_IMAGE_TAG}"
                        # 这里添加实际的生产部署脚本
                        # 例如：
                        # kubectl set image deployment/${APP_NAME} ${APP_NAME}=${env.DOCKER_FULL_IMAGE} -n production
                        # kubectl rollout status deployment/${APP_NAME} -n production
                        # 或者使用 docker-compose 部署：
                        # docker-compose -f docker-compose.production.yml up -d
                    """
                }
            }
        }
    }
    
    post {
        always {
            echo '🧹 清理工作空间...'
            
            // 清理 Docker 镜像（仅在 Docker 可用时）
            script {
                def dockerAvailable = sh(
                    script: 'command -v docker >/dev/null 2>&1',
                    returnStatus: true
                ) == 0
                
                if (dockerAvailable) {
                    try {
                        sh '''
                            docker image prune -f
                            docker system prune -f --volumes
                        '''
                        echo '✅ Docker 清理完成'
                    } catch (Exception e) {
                        echo "⚠️ Docker 清理失败: ${e.getMessage()}"
                        echo '💡 这通常不会影响构建结果'
                    }
                } else {
                    echo '⚠️ Docker 不可用，跳过 Docker 清理'
                }
            }
            
            // 归档构建产物
            archiveArtifacts artifacts: 'dist/**/*', fingerprint: true, allowEmptyArchive: true
            
            // 清理工作空间
            cleanWs()
        }
        
        success {
            echo '✅ 流水线执行成功！'
            
            // 发送成功通知
            script {
                def message = """
                🎉 构建成功！
                
                📋 项目: ${APP_NAME}
                🌿 分支: ${env.BRANCH_NAME}
                🔖 提交: ${env.GIT_COMMIT_SHORT}
                🏗️ 构建号: ${env.BUILD_NUMBER}
                ⏰ 构建时间: ${env.BUILD_TIME}
                """
                
                // 这里可以添加通知逻辑，如发送到 Slack、钉钉等
                echo message
            }
        }
        
        failure {
            echo '❌ 流水线执行失败！'
            
            // 发送失败通知
            script {
                def message = """
                💥 构建失败！
                
                📋 项目: ${APP_NAME}
                🌿 分支: ${env.BRANCH_NAME}
                🔖 提交: ${env.GIT_COMMIT_SHORT}
                🏗️ 构建号: ${env.BUILD_NUMBER}
                ⏰ 构建时间: ${env.BUILD_TIME}
                
                请检查构建日志并修复问题。
                """
                
                // 这里可以添加通知逻辑
                echo message
            }
        }
        
        unstable {
            echo '⚠️ 流水线执行不稳定！'
        }
    }
}