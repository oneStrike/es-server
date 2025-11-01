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
                        // 检查是否支持 buildx，如果不支持则使用传统 docker build
                        def buildxSupported = sh(
                            script: 'docker buildx version >/dev/null 2>&1',
                            returnStatus: true
                        ) == 0
                        
                        if (buildxSupported) {
                            echo '🔧 使用 Docker Buildx 构建镜像...'
                            sh """
                                export DOCKER_BUILDKIT=1
                                docker buildx build --platform linux/amd64 -t ${fullImageName} --load .
                            """
                        } else {
                            echo '🔧 使用传统 Docker 构建镜像...'
                            sh """
                                export DOCKER_BUILDKIT=1
                                docker build -t ${fullImageName} .
                            """
                        }
                        
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