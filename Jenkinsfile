pipeline {
    agent any
    
    environment {
        REGISTRY_URL = 'ccr.ccs.tencentyun.com'
        NAMESPACE = 'akaiito'
        IMAGE_NAME = 'akaiito-server'
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo '📥 检出代码...'
                git branch: 'main', url: 'https://github.com/oneStrike/es-server.git'
            }
        }
        
        stage('Build and Push Docker Image') {
            steps {
                script {
                    echo '🐳 构建 Docker 镜像...'
                    
                    def imageTag = "${env.BUILD_NUMBER}"
                    def fullImageName = "${REGISTRY_URL}/${NAMESPACE}/${IMAGE_NAME}:${imageTag}"
                    
                    try {
                        // 构建 Docker 镜像（包含所有构建步骤）
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
            echo '🧹 清理工作空间...'
            sh 'docker system prune -f --volumes || true'
            cleanWs()
        }
        success {
            echo '✅ 流水线执行成功！'
        }
        failure {
            echo '❌ 流水线执行失败！'
        }
        unstable {
            echo '⚠️ 流水线执行不稳定！'
        }
    }
}