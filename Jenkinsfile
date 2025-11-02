pipeline {
    agent any

    environment {
        REGISTRY_URL = 'ccr.ccs.tencentyun.com'
        NAMESPACE = 'akaiito'
        IMAGE_NAME = 'akaiito-server'
    }
    
    stages {
        stage('Build and Push Docker Image') {
            steps {
                script {
                    echo '🐳 构建 Docker 镜像...'
                    
                    def imageTag = "${env.BUILD_NUMBER}"
                    def fullImageName = "${REGISTRY_URL}/${NAMESPACE}/${IMAGE_NAME}:${imageTag}"
                    
                    try {
                        // 使用传统 Docker 构建命令，不启用 BuildKit 以确保最大兼容性
                        echo '🔧 使用传统 Docker 构建镜像（禁用 BuildKit）...'
                        sh """
                            docker build -t ${fullImageName} .
                        """
                        
                        // 推送到镜像仓库
                        docker.withRegistry("https://${REGISTRY_URL}", 'tencent-cloud-registry') {
                            sh "docker push ${fullImageName}"
                            sh "docker tag ${fullImageName} ${REGISTRY_URL}/${NAMESPACE}/${IMAGE_NAME}:latest"
                            sh "docker push ${REGISTRY_URL}/${NAMESPACE}/${IMAGE_NAME}:latest"
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