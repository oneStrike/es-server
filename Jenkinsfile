pipeline {
    agent any
    
    options {
        // 增加超时时间和重试机制
        timeout(time: 30, unit: 'MINUTES')
        retry(2)
        // Git 克隆配置
        skipDefaultCheckout(true)
    }
    
    tools {
        nodejs 'NodeJS-22'
        dockerTool 'docker-latest'
    }
    
    environment {
        REGISTRY_URL = 'ccr.ccs.tencentyun.com'
        NAMESPACE = 'akaiito'
        IMAGE_NAME = 'akaiito-server'
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo '📥 检出代码...'
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    extensions: [
                        [$class: 'CloneOption', timeout: 20, shallow: true, depth: 1],
                        [$class: 'CheckoutOption', timeout: 20]
                    ],
                    userRemoteConfigs: [[url: 'https://github.com/oneStrike/es-server.git']]
                ])
            }
        }
        stage('Setup Environment') {
            steps {
                echo '🚀 设置构建环境...'
                sh 'node --version'
                sh 'npm --version'
                
                // 安装 PNPM
                sh 'npm install -g pnpm'
                sh 'pnpm --version'
            }
        }
        
        stage('Install Dependencies') {
            steps {
                echo '📦 安装项目依赖...'
                script {
                    try {
                        // 设置 npm 配置以提高稳定性
                        sh '''
                            npm config set registry https://registry.npmmirror.com/
                            npm config set timeout 300000
                            npm config set fetch-timeout 300000
                            npm config set fetch-retry-mintimeout 20000
                            npm config set fetch-retry-maxtimeout 120000
                        '''
                        sh 'npm install --production'
                    } catch (Exception e) {
                        echo "依赖安装失败，尝试清理缓存后重试..."
                        sh 'npm cache clean --force'
                        sh 'rm -rf node_modules package-lock.json'
                        sh 'npm install --production'
                    }
                }
            }
        }
        
        stage('Code Quality') {
            steps {
                echo '🔍 运行代码质量检查...'
                
                // ESLint 检查
                sh 'pnpm run lint'
                
                // 类型检查
                sh 'pnpm run type-check'
            }
        }
        
        stage('Build Application') {
            steps {
                echo '🏗️ 构建应用程序...'
                sh 'pnpm run build'
                
                // 验证构建结果
                sh 'ls -la dist/'
            }
        }
        
        stage('B                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    ') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'develop'
                }
            }
            steps {
                script {
                    echo '🐳 构建 Docker 镜像...'
                    
                    def imageTag = "${env.BUILD_NUMBER}"
                    def fullImageName = "${REGISTRY_URL}/${NAMESPACE}/${IMAGE_NAME}:${imageTag}"
                    
                    // 构建 Docker 镜像
                    def dockerImage = docker.build(fullImageName)
                    
                    // 推送到镜像仓库
                    docker.withRegistry("https://${REGISTRY_URL}", 'tencent-cloud-registry') {
                        dockerImage.push()
                        dockerImage.push('latest')
                    }
                    
                    echo "✅ Docker 镜像推送完成: ${fullImageName}"
                }
            }
        }
    }
    
    post {
        always {
            node {
                script {
                    try {
                        echo '🧹 清理工作空间...'
                        // 清理 Docker 资源
                        sh 'docker system prune -f || true'
                        sh 'docker image prune -f || true'
                        // 清理工作空间
                        cleanWs()
                    } catch (Exception e) {
                        echo "清理过程中出现错误: ${e.getMessage()}"
                    }
                }
            }
        }
        success {
            echo '✅ 流水线执行成功！'
        }
        failure {
            echo '❌ 流水线执行失败！'
        }
        unstable {
            echo '⚠️ 流水线执行完成但有警告！'
        }
    }
}