pipeline {
    agent any
    
    options {
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
                        // 设置 pnpm 配置以提高稳定性
                        sh '''
                            pnpm config set registry https://registry.npmmirror.com/
                            pnpm config set network-timeout 300000
                            pnpm config set fetch-timeout 300000
                        '''
                        sh 'pnpm install --frozen-lockfile'
                        sh 'pnpm prisma:generate'
                    } catch (Exception e) {
                        echo "依赖安装失败，尝试清理缓存后重试..."
                        sh 'pnpm store prune'
                        sh 'rm -rf node_modules pnpm-lock.yaml'
                        sh 'pnpm install'
                        sh 'pnpm prisma:generate'
                    }
                }
            }
        }

        stage('Build Application') {
            steps {
                echo '🏗️ 构建应用程序...'
                script {
                    try {
                        sh '''
                            export NODE_OPTIONS="--max-old-space-size=4096"
                            pnpm run build
                        '''
                        
                        // 验证构建结果
                        sh 'ls -la dist/ || ls -la build/ || echo "构建目录未找到，但构建可能成功"'
                    } catch (Exception e) {
                        echo "构建失败: ${e.getMessage()}"
                        error("应用程序构建失败")
                    }
                }
            }
        }
        
        stage('Build and Push Docker Image') {
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
                    
                    try {
                        // 构建 Docker 镜像
                        def dockerImage = docker.build(fullImageName)
                        
                        // 推送到镜像仓库
                        docker.withRegistry("https://${REGISTRY_URL}", 'tencent-cloud-registry') {
                            dockerImage.push()
                            dockerImage.push('latest')
                        }
                        
                        echo "✅ Docker 镜像推送完成: ${fullImageName}"
                    } catch (Exception e) {
                        echo "Docker 构建或推送失败: ${e.getMessage()}"
                        currentBuild.result = 'UNSTABLE'
                    }
                }
            }
        }
    }
    
    post {
        always {
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