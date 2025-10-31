pipeline {
    agent any
    
    environment {
        GIT_CREDENTIALS = credentials('github')
        APP_NAME = 'akaiito-server'
        // Docker镜像仓库配置 - 腾讯云容器镜像服务
        DOCKER_REGISTRY = 'ccr.ccs.tencentyun.com'
        DOCKER_IMAGE = "${DOCKER_REGISTRY}/akaiito/${APP_NAME}"  // 使用双引号允许变量插值
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                
                script {
                    // 获取Git提交信息
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    
                    env.GIT_BRANCH_NAME = sh(
                        script: 'git rev-parse --abbrev-ref HEAD',
                        returnStdout: true
                    ).trim()
                    
                    // 获取提交消息和作者
                    env.GIT_COMMIT_MESSAGE = sh(
                        script: 'git log -1 --pretty=%B',
                        returnStdout: true
                    ).trim()
                    
                    env.GIT_COMMIT_AUTHOR = sh(
                        script: 'git log -1 --pretty=%an',
                        returnStdout: true
                    ).trim()
                    
                    // 构建版本号
                    env.BUILD_VERSION = "${env.BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"
                    currentBuild.displayName = "#${env.BUILD_NUMBER} (${env.GIT_COMMIT_SHORT})"
                    
                    // 输出提交信息
                    echo "分支: ${env.GIT_BRANCH_NAME}"
                    echo "提交: ${env.GIT_COMMIT_SHORT}"
                    echo "作者: ${env.GIT_COMMIT_AUTHOR}"
                    echo "消息: ${env.GIT_COMMIT_MESSAGE}"
                }
            }
        }
        
        stage('Setup Environment') {
            steps {
                script {
                    // 设置为生产环境
                    env.DEPLOY_ENV = 'production'
                    
                    // 设置Docker Compose配置文件
                    env.COMPOSE_FILE = 'docker-compose.yml'  // 仅使用主配置文件
                    env.ENV_FILE = '.env.production'
                    
                    echo "部署环境: ${env.DEPLOY_ENV}"
                    echo "Docker Compose文件: ${env.COMPOSE_FILE}"
                    echo "环境变量文件: ${env.ENV_FILE}"
                }
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    // 检查Dockerfile是否存在
                    if (!fileExists('Dockerfile')) {
                        error "❌ 错误: 未找到Dockerfile文件"
                    }
                    
                    // 构建Docker镜像
                    def buildArgs = "--build-arg BUILD_VERSION=${env.BUILD_VERSION} --build-arg GIT_COMMIT=${env.GIT_COMMIT_SHORT}"
                    buildArgs += " --build-arg NODE_ENV=production"
                    
                    echo "正在构建Docker镜像: ${DOCKER_IMAGE}"
                    sh """
                        docker build ${buildArgs} -t ${DOCKER_IMAGE}:${env.BUILD_VERSION} .
                        docker tag ${DOCKER_IMAGE}:${env.BUILD_VERSION} ${DOCKER_IMAGE}:latest
                    """
                    
                    // 推送镜像
                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'docker-registry-creds') {
                        docker.image("${DOCKER_IMAGE}:${env.BUILD_VERSION}").push()
                        docker.image("${DOCKER_IMAGE}:latest").push()
                    }
                    
                    // 生产环境镜像打标签
                    def productionTag = "${DOCKER_IMAGE}:production"
                    sh """
                        docker tag ${DOCKER_IMAGE}:${env.BUILD_VERSION} ${productionTag}
                    """
                    
                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'docker-registry-creds') {
                        docker.image("${productionTag}").push()
                    }
                    
                    echo "生产环境镜像已推送:"
                    echo "  - ${DOCKER_IMAGE}:${env.BUILD_VERSION}"
                    echo "  - ${DOCKER_IMAGE}:latest"
                    echo "  - ${productionTag}"
                }
            }
        }
        
        stage('Deploy') {
            steps {
                script {
                    // 生产环境使用蓝绿部署
                    deployBlueGreen()
                }
            }
        }
        
        stage('Health Check') {
            steps {
                script {
                    // 等待服务启动
                    sleep(60)
                    
                    // 健康检查
                    def healthUrl = getHealthCheckUrl()
                    def maxAttempts = 10
                    def attempt = 0
                    
                    while (attempt < maxAttempts) {
                        attempt++
                        try {
                            def response = sh(
                                script: "curl -s -o /dev/null -w '%{http_code}' ${healthUrl}",
                                returnStdout: true
                            ).trim()
                            
                            if (response == '200') {
                                echo "健康检查通过"
                                return
                            }
                            
                            echo "健康检查失败 (尝试 ${attempt}/${maxAttempts}), HTTP状态码: ${response}"
                            sleep(10)
                        } catch (Exception e) {
                            echo "健康检查异常 (尝试 ${attempt}/${maxAttempts}): ${e.getMessage()}"
                            sleep(10)
                        }
                    }
                    
                    error "健康检查失败，已尝试${maxAttempts}次"
                }
            }
        }
    }
    
    post {
        success {
            script {
                // 发送成功通知
                def message = """
                ✅ 部署成功!
                🌍 环境: ${env.DEPLOY_ENV}
                🏷️ 版本: ${env.BUILD_VERSION}
                👤 作者: ${env.GIT_COMMIT_AUTHOR}
                🔗 访问地址: ${getAppUrl()}
                🔗 查看日志: ${env.BUILD_URL}console
                """
                
                sendNotification(message, 'success')
                
                // 生产环境创建Git标签
                withCredentials([usernamePassword(credentialsId: "${GIT_CREDENTIALS}", usernameVariable: 'GIT_USER', passwordVariable: 'GIT_PASS')]) {
                    sh """
                        git config user.name "Jenkins"
                        git config user.email "jenkins@${GIT_USER}@jenkins"
                        git tag "v${env.BUILD_NUMBER}" -m "Release version ${env.BUILD_NUMBER}: ${env.GIT_COMMIT_MESSAGE}"
                        git push origin "v${env.BUILD_NUMBER}"
                    """
                    echo "已创建Git标签: v${env.BUILD_NUMBER}"
                }
            }
        }
        
        failure {
            script {
                // 发送失败通知
                def message = """
                ❌ 部署失败!
                🌍 环境: ${env.DEPLOY_ENV}
                🏷️ 版本: ${env.BUILD_VERSION}
                👤 作者: ${env.GIT_COMMIT_AUTHOR}
                🔗 查看日志: ${env.BUILD_URL}console
                """
                
                sendNotification(message, 'failure')
                
                // 生产环境执行回滚
                echo "生产环境部署失败，执行回滚..."
                rollback()
            }
        }
        
        unstable {
            script {
                // 发送不稳定通知
                def message = """
                ⚠️ 部署不稳定!
                📦 应用: ${APP_NAME}
                🌍 环境: ${env.DEPLOY_ENV}
                🏷️ 版本: ${env.BUILD_VERSION}
                👤 作者: ${env.GIT_COMMIT_AUTHOR}
                🔗 查看日志: ${env.BUILD_URL}console
                """
                
                sendNotification(message, 'warning')
            }
        }
        
        always {
            script {
                node {
                    // 清理工作空间
                    cleanWs()
                }
            }
        }
    }
}

// 辅助函数
def deployBlueGreen() {
    node {
        // 获取当前活跃环境
        def currentEnv = sh(
            script: "docker service ls --filter name=${APP_NAME}-prod --format '{{.Name}}' | head -1",
            returnStdout: true
        ).trim()
    
    def targetEnv = currentEnv.contains('blue') ? 'green' : 'blue'
    
    echo "当前活跃环境: ${currentEnv}, 部署到: ${targetEnv}"
    
    // 部署到非活跃环境 - 使用统一的Docker镜像名称
    sh """
    docker-compose -f ${env.COMPOSE_FILE} -p ${APP_NAME}-${targetEnv} up -d
    """
    
    // 等待部署完成
    sleep(120)
    
    // 切换流量
    sh """
    # 切换负载均衡器配置
    # 这里根据实际负载均衡器类型进行配置
    """
    
    // 清理旧环境
    sh """
    docker-compose -f ${env.COMPOSE_FILE} -p ${APP_NAME}-${currentEnv} down
    """
    }
}

def getHealthCheckUrl() {
    return "https://your-domain.com/api/health"
}

def getAppUrl() {
    return "https://your-domain.com"
}

def rollback() {
    node {
        // 获取上一个成功版本
        def lastSuccessfulBuild = currentBuild.previousBuild
        while (lastSuccessfulBuild != null && lastSuccessfulBuild.result != 'SUCCESS') {
            lastSuccessfulBuild = lastSuccessfulBuild.previousBuild
        }
        
        if (lastSuccessfulBuild == null) {
            error "没有找到可回滚的版本"
        }
        
        def lastVersion = "${lastSuccessfulBuild.number}-${lastSuccessfulBuild.getChangeSets()[0].getRevisions()[0].getRevision().substring(0, 7)}"
        
        echo "回滚到版本: ${lastVersion}"
        
        sh """
        docker-compose -f ${env.COMPOSE_FILE} -p ${APP_NAME}-${env.DEPLOY_ENV} pull app:${lastVersion}
        docker-compose -f ${env.COMPOSE_FILE} -p ${APP_NAME}-${env.DEPLOY_ENV} up -d --no-deps app
        """
    }
}

def sendNotification(message, status) {
    // 这里可以集成各种通知方式，如邮件、Slack、钉钉等
    echo "${message}"
    
    // 示例：发送邮件通知
    // emailext (
    //     subject: "部署通知 - ${status}",
    //     body: "${message}",
    //     to: "${env.CHANGE_AUTHOR_EMAIL}"
    // )
}