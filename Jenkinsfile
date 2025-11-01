pipeline {
    agent {
        node {
            label 'any'
        }
    }
    
    tools {
        nodejs 'NodeJS-22'
        dockerTool 'docker-latest'
    }
    
    environment {
        REGISTRY_URL = 'ccr.ccs.tencentyun.com'
        IMAGE_NAME = 'es-server'
        NAMESPACE = 'es-namespace'
    }
    
    stages {
        stage('Setup Environment') {
            steps {
                echo '🚀 Setting up environment...'
                sh 'node --version'
                sh 'npm --version'
                
                // 安装 PNPM
                sh 'npm install -g pnpm'
                sh 'pnpm --version'
            }
        }
        
        stage('Install Dependencies') {
            steps {
                echo '📦 Installing dependencies...'
                sh 'pnpm install --frozen-lockfile'
            }
        }
        
        stage('Code Quality') {
            steps {
                echo '🔍 Running code quality checks...'
                
                // ESLint 检查
                sh 'pnpm run lint'
                
                // 类型检查
                sh 'pnpm run build'
                
                // 格式检查
                sh 'pnpm run format:check'
            }
        }
        
        stage('Test') {
            steps {
                echo '🧪 Running tests...'
                sh 'pnpm run test'
            }
        }
        
        stage('Build Application') {
            steps {
                echo '🏗️ Building application...'
                sh 'pnpm run build'
                
                // 验证构建结果
                sh 'ls -la dist/'
            }
        }
        
        stage('Build & Push Docker Image') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'develop'
                }
            }
            steps {
                script {
                    echo '🐳 Building Docker image...'
                    
                    def imageTag = "${env.BUILD_NUMBER}"
                    def fullImageName = "${REGISTRY_URL}/${NAMESPACE}/${IMAGE_NAME}:${imageTag}"
                    
                    // 构建 Docker 镜像
                    def dockerImage = docker.build(fullImageName)
                    
                    // 推送到镜像仓库
                    docker.withRegistry("https://${REGISTRY_URL}", 'tencent-cloud-registry') {
                        dockerImage.push()
                        dockerImage.push('latest')
                    }
                    
                    echo "✅ Docker image pushed: ${fullImageName}"
                }
            }
        }
    }
    
    post {
        always {
            echo '🧹 Cleaning up...'
            
            // 清理 Docker 镜像（保留最新的几个版本）
            sh '''
                docker image prune -f
                docker images | grep "${IMAGE_NAME}" | tail -n +6 | awk '{print $3}' | xargs -r docker rmi || true
            '''
        }
        
        success {
            echo '✅ Pipeline completed successfully!'
        }
        
        failure {
            echo '❌ Pipeline failed!'
        }
        
        unstable {
            echo '⚠️ Pipeline completed with warnings!'
        }
    }
}