pipeline {
    agent any

    environment {
        AWS_REGION = 'ap-south-1'
        ECR_REPO = '864981730114.dkr.ecr.ap-south-1.amazonaws.com/bold-ai'
        ECS_CLUSTER = 'snsihub-cluster-dev'
        ECS_SERVICE = 'bold-ai-service'
        TASK_FAMILY = 'bold-ai'  // Task Definition Name
        CONTAINER_NAME = 'bold-ai'   // Name of the container inside ECS task definition
    }

    stages {
        stage('AWS ECR Login') {
            steps {
                script {
                    sh 'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO'
                }
            }
        }

        stage('Build & Push Docker Image') {
            steps {
                script {
                    sh """
                    docker build -t ${ECR_REPO}:latest .
                    docker tag ${ECR_REPO}:latest ${ECR_REPO}:latest
                    docker push ${ECR_REPO}:latest
                    """
                }
            }
        }

        stage('Register New Task Definition with Latest Image') {
            steps {
                script {
                    // Fetch the existing task definition
                    sh "aws ecs describe-task-definition --task-definition $TASK_FAMILY --query 'taskDefinition' > task-def.json"

                    // Modify the task definition to update the container image
                    sh """
                    jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy) |
                        .containerDefinitions[0].image = "${ECR_REPO}:latest"' task-def.json > new-task-def.json
                    """

                    // Register the updated task definition
                    sh "aws ecs register-task-definition --cli-input-json file://new-task-def.json"
                }
            }
        }

        stage('Update ECS Service with New Task Definition') {
            steps {
                script {
                    def TASK_REVISION = sh(script: "aws ecs describe-task-definition --task-definition $TASK_FAMILY --query 'taskDefinition.revision' --output text", returnStdout: true).trim()
                    echo "New Task Definition Revision: ${TASK_REVISION}"

                    sh """
                    aws ecs update-service --cluster ${ECS_CLUSTER} --service ${ECS_SERVICE} --task-definition ${TASK_FAMILY}:${TASK_REVISION} --force-new-deployment
                    """
                }
            }
        }
    }

    post {
        success {
            echo '✅ Backend Deployment Successful! 🎉'

            // 🔥 Remove unused Docker images **immediately**
            sh 'docker image prune -a -f'

            // 🔥 Remove stopped containers
            sh 'docker container prune -f'
        }
        failure {
            echo '❌ Backend Deployment Failed!'

            // 🔥 Cleanup failed build images
            sh 'docker image prune -a -f'
        }
        always {
            // 🔄 Ensure unused volumes and networks are cleaned up
            sh 'docker system prune -f --volumes'
        }
    }
}
