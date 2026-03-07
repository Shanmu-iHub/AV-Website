pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "av-website"
        DOCKER_TAG = "${env.BUILD_NUMBER}"
        // Add your Docker Hub or Private Registry credentials ID here
        // DOCKER_CREDENTIALS_ID = 'docker-hub-credentials'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Security Scan (Optional)') {
            steps {
                echo 'Running audit...'
                sh 'npm audit --audit-level=high'
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} ."
                    sh "docker tag ${DOCKER_IMAGE}:${DOCKER_TAG} ${DOCKER_IMAGE}:latest"
                }
            }
        }

        stage('Push to Registry') {
            /* 
            Uncomment and configure if pushing to a registry
            steps {
                script {
                    docker.withRegistry('', DOCKER_CREDENTIALS_ID) {
                        sh "docker push ${DOCKER_IMAGE}:${DOCKER_TAG}"
                        sh "docker push ${DOCKER_IMAGE}:latest"
                    }
                }
            }
            */
            steps {
                echo 'Skipping push - registry not configured'
            }
        }

        stage('Deploy') {
            steps {
                echo 'Deploying to staging/production server...'
                // Example: Restart docker container
                // sh "docker stop av-website-container || true"
                // sh "docker rm av-website-container || true"
                // sh "docker run -d --name av-website-container -p 80:3000 ${DOCKER_IMAGE}:latest"
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo 'Pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed. Please check the logs.'
        }
    }
}
