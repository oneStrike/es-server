pipeline {
    agent any
    
    tools {
        // 使用 NodeJS 插件管理 Node.js 版本
        nodejs 'NodeJS-22'  // 需要在 Jenkins 全局工具配置中设置
        // 使用 Docker 工具
        dockerTool 'docker-latest'  // 需要在 Jenkins 全局工具配置中设置
    }
    
    environment {
        // 工具版本管理
        NODE_VERSION = '22.12.0'
        PNPM_VERSION = '9.15.0'
        DOCKER_BUILDKIT = '1'
        
        // 缓存配置
        PNPM_CACHE_FOLDER = "${WORKSPACE}/.pnpm-store"
        NODE_MODULES_CACHE = "${WORKSPACE}/node_modules"
        PNPM_HOME = '/root/.local/share/pnpm'
        PATH = '/root/.local/share/pnpm:$PATH'
        
        // Docker 配置
        DOCKER_IMAGE = 'akaiito-server'
        DOCKER_REGISTRY = 'ccr.ccs.tencentyun.com'
        DOCKER_NAMESPACE = 'akaiito'
        DOCKER_IMAGE_FULL_PATH = 'ccr.ccs.tencentyun.com/akaiito/akaiito-server'
        DOCKER_USERNAME = '100014575720'
        
        // 应用配置
        APP_NAME = 'es-server'
        DEPLOY_ENV = 'production'
        
        // 通知配置
        WECHAT_WEBHOOK_URL = credentials('wechat-webhook-url')  // 需要在 Jenkins 中配置
        
        // 构建配置
        BUILD_TIMESTAMP = sh(script: 'date +%Y%m%d-%H%M%S', returnStdout: true).trim()
    }
    
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
                
                script {
                    // 验证工具版本（NodeJS 插件自动设置环境）
                    sh '''
                        echo "Node.js version: $(node --version)"
                        echo "NPM version: $(npm --version)"
                    '''
                    
                    // 配置 PNPM 缓存
                    sh """
                        echo '📦 配置 PNPM 缓存...'
                        mkdir -p ${PNPM_CACHE_FOLDER}
                        npm install -g pnpm@${PNPM_VERSION}
                        pnpm config set store-dir ${PNPM_CACHE_FOLDER}
                        pnpm config set cache-dir ${WORKSPACE}/.pnpm-cache
                        echo "PNPM version: \$(pnpm --version)"
                    """
                }
            }
        }
        
        stage('Install Dependencies') {
            steps {
                echo '📦 安装项目依赖...'
                
                script {
                    // 使用缓存检查依赖是否需要重新安装
                    def lockfileHash = sh(
                        script: 'sha256sum pnpm-lock.yaml | cut -d" " -f1',
                        returnStdout: true
                    ).trim()
                    
                    def cacheFile = "${WORKSPACE}/.deps-cache-${lockfileHash}"
                    
                    if (fileExists(cacheFile) && fileExists('node_modules')) {
                        echo '✅ 使用缓存的依赖'
                    } else {
                        echo '📥 安装新依赖...'
                        sh '''
                            pnpm install --frozen-lockfile --prefer-offline
                            touch .deps-cache-''' + lockfileHash + '''
                        '''
                    }
                }
            }
        }
        
        stage('Code Quality') {
            parallel {
                stage('Lint') {
                    steps {
                        echo '🔍 运行代码检查...'
                        script {
                            try {
                                sh 'pnpm run lint'
                                echo '✅ ESLint 检查通过'
                            } catch (Exception e) {
                                currentBuild.result = 'UNSTABLE'
                                echo "⚠️ 代码检查失败: ${e.getMessage()}"
                            }
                        }
                    }
                    post {
                        always {
                            // 发布 ESLint 报告（如果存在）
                            publishHTML([
                                allowMissing: true,
                                alwaysLinkToLastBuild: false,
                                keepAll: true,
                                reportDir: 'reports',
                                reportFiles: 'eslint-report.html',
                                reportName: 'ESLint Report'
                            ])
                        }
                    }
                }
                
                stage('Type Check') {
                    steps {
                        echo '📝 运行类型检查...'
                        script {
                            try {
                                sh 'pnpm run type-check'
                                echo '✅ 类型检查通过'
                            } catch (Exception e) {
                                currentBuild.result = 'UNSTABLE'
                                echo "⚠️ 类型检查失败: ${e.getMessage()}"
                            }
                        }
                    }
                }
                
                stage('Format Check') {
                    steps {
                        echo '🎨 检查代码格式...'
                        script {
                            try {
                                sh 'npx prettier --check "src/**/*.{ts,js,json}"'
                                echo '✅ 代码格式检查通过'
                            } catch (Exception e) {
                                currentBuild.result = 'UNSTABLE'
                                echo "⚠️ 代码格式检查失败: ${e.getMessage()}"
                            }
                        }
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
        
        stage('Build Application') {
            steps {
                echo '🏗️ 构建应用程序...'
                
                script {
                    try {
                        // 构建应用
                        sh '''
                            echo "开始构建应用..."
                            pnpm run build
                            
                            # 验证构建产物
                            if [ ! -d "dist" ]; then
                                echo "❌ 构建失败：dist 目录不存在"
                                exit 1
                            fi
                            
                            echo "✅ 应用构建完成"
                        '''
                        
                        // 构建产物大小统计
                        sh '''
                            echo "📊 构建产物统计："
                            du -sh dist/
                            find dist -name "*.js" -exec wc -c {} + | tail -1 | awk '{print "JavaScript files total size: " $1 " bytes"}'
                        '''
                        
                    } catch (Exception e) {
                        currentBuild.result = 'FAILURE'
                        error "❌ 应用构建失败: ${e.getMessage()}"
                    }
                }
            }
            post {
                success {
                    // 归档构建产物
                    archiveArtifacts artifacts: 'dist/**/*', fingerprint: true
                }
                failure {
                    echo '❌ 构建失败，请检查构建日志'
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
                    
                    echo '📦 准备构建上下文...'
                    // 确保构建产物存在
                    sh """
                        echo "检查构建产物..."
                        ls -la dist/
                        ls -la node_modules/ | head -10
                        echo "构建产物检查完成"
                    """
                    
                    // 使用 Docker Pipeline 插件构建镜像
                    echo "开始构建 Docker 镜像..."
                    def dockerImage = docker.build("${DOCKER_IMAGE}:${imageTag}", 
                        "--cache-from ${DOCKER_IMAGE}:latest --build-arg BUILDKIT_INLINE_CACHE=1 .")
                    
                    // 打标签
                    dockerImage.tag("${DOCKER_IMAGE}:latest")
                    dockerImage.tag(fullImageName)
                    dockerImage.tag("${DOCKER_IMAGE_FULL_PATH}:latest")
                    
                    echo "Docker 镜像构建完成"
                    
                    // 如果是主分支，推送到腾讯云容器镜像服务
                    if (env.BRANCH_NAME == 'main' || env.BRANCH_NAME == 'master') {
                        echo '📤 推送 Docker 镜像到腾讯云容器镜像服务...'
                        
                        // 使用 Docker Pipeline 插件推送
                        docker.withRegistry("https://${DOCKER_REGISTRY}", 'tencent-cloud-registry') {
                            dockerImage.push(imageTag)
                            dockerImage.push('latest')
                        }
                        
                        echo '✅ 镜像推送完成'
                    } else {
                        echo '⚠️ 非主分支，跳过镜像推送'
                    }
                    
                    // 保存镜像信息供后续阶段使用
                    env.DOCKER_IMAGE_TAG = imageTag
                    env.DOCKER_FULL_IMAGE = fullImageName
                    
                    echo "✅ Docker 构建阶段完成"
                    echo "   - 镜像标签: ${imageTag}"
                    echo "   - 完整镜像名: ${fullImageName}"
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
            
            // 清理 Docker 镜像（保留最新的几个版本）
            script {
                def dockerAvailable = sh(
                    script: 'command -v docker >/dev/null 2>&1',
                    returnStatus: true
                ) == 0
                
                if (dockerAvailable) {
                    try {
                        sh '''
                            # 清理悬空镜像
                            docker image prune -f
                            
                            # 保留最新的3个版本，删除其他版本
                            docker images ${DOCKER_IMAGE} --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | \
                            tail -n +2 | sort -k2 -r | tail -n +4 | awk '{print $1}' | xargs -r docker rmi
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
            
            script {
                // 发送成功通知
                def buildDuration = currentBuild.durationString.replace(' and counting', '')
                def message = """
🎉 构建成功！

📋 **项目**: ${env.JOB_NAME}
🏷️ **分支**: ${env.BRANCH_NAME}
🔢 **构建号**: ${env.BUILD_NUMBER}
⏱️ **耗时**: ${buildDuration}
🔗 **构建链接**: ${env.BUILD_URL}

📊 **构建信息**:
- Node.js: ${NODE_VERSION}
- PNPM: ${PNPM_VERSION}
- Docker 镜像: ${DOCKER_IMAGE_FULL_PATH}:${BUILD_NUMBER}
"""
                
                // 企业微信通知（需要配置 webhook）
                try {
                    httpRequest(
                        httpMode: 'POST',
                        url: '${WECHAT_WEBHOOK_URL}',
                        contentType: 'APPLICATION_JSON',
                        requestBody: """
                        {
                            "msgtype": "markdown",
                            "markdown": {
                                "content": "${message}"
                            }
                        }
                        """
                    )
                } catch (Exception e) {
                    echo "发送企业微信通知失败: ${e.getMessage()}"
                }
            }
        }
        
        failure {
            echo '❌ 流水线执行失败！'
            
            script {
                def buildDuration = currentBuild.durationString.replace(' and counting', '')
                def message = """
❌ 构建失败！

📋 **项目**: ${env.JOB_NAME}
🏷️ **分支**: ${env.BRANCH_NAME}
🔢 **构建号**: ${env.BUILD_NUMBER}
⏱️ **耗时**: ${buildDuration}
🔗 **构建链接**: ${env.BUILD_URL}
📝 **日志**: ${env.BUILD_URL}console

⚠️ **失败原因**: ${currentBuild.description ?: '请查看构建日志'}
"""
                
                // 发送失败通知
                try {
                    httpRequest(
                        httpMode: 'POST',
                        url: '${WECHAT_WEBHOOK_URL}',
                        contentType: 'APPLICATION_JSON',
                        requestBody: """
                        {
                            "msgtype": "markdown",
                            "markdown": {
                                "content": "${message}"
                            }
                        }
                        """
                    )
                } catch (Exception e) {
                    echo "发送企业微信通知失败: ${e.getMessage()}"
                }
            }
        }
        
        unstable {
            echo '⚠️ 流水线执行不稳定（有警告）'
            
            script {
                def message = """
⚠️ 构建不稳定！

📋 **项目**: ${env.JOB_NAME}
🏷️ **分支**: ${env.BRANCH_NAME}  
🔢 **构建号**: ${env.BUILD_NUMBER}
🔗 **构建链接**: ${env.BUILD_URL}

💡 **提示**: 构建完成但存在警告，请检查代码质量报告
"""
                
                try {
                    httpRequest(
                        httpMode: 'POST',
                        url: '${WECHAT_WEBHOOK_URL}',
                        contentType: 'APPLICATION_JSON',
                        requestBody: """
                        {
                            "msgtype": "markdown",
                            "markdown": {
                                "content": "${message}"
                            }
                        }
                        """
                    )
                } catch (Exception e) {
                    echo "发送企业微信通知失败: ${e.getMessage()}"
                }
            }
        }
    }
}