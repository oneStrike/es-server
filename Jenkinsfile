pipeline {
    agent any
    
    tools {
        nodejs 'NodeJS-22'
        dockerTool 'docker-latest'
    }
    
    environment {
        REGISTRY_URL = 'ccr.ccs.tencentyun.com'
        IMAGE_NAME = 'akaiito-server'
        NAMESPACE = 'akaiito'
    }
    
    stages {
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
                sh 'pnpm install --frozen-lockfile'
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
            script {
                try {
                    echo '🧹 清理工作空间...'
                    
                    // 清理 Docker 镜像（保留最新的几个版本）
                    sh '''
                        docker image prune -f || true
                        docker images | grep "${IMAGE_NAME}" | tail -n +6 | awk '{print $3}' | xargs -r docker rmi || true
                    '''
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