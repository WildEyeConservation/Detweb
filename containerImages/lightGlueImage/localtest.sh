#!/bin/bash

# Run AWS STS assume-role and capture the credentials
JSON_RESPONSE=$(aws sts assume-role \
    --role-arn "arn:aws:iam::275736403632:role/amplify-d2akirfrcp5tqu-prod-bra-EcsTaskRole8DFA0181-JDQauZPkwg6u" \
    --role-session-name "hannes")

# Extract the credentials
export AWS_ACCESS_KEY_ID=$(echo $JSON_RESPONSE | jq -r .Credentials.AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo $JSON_RESPONSE | jq -r .Credentials.SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo $JSON_RESPONSE | jq -r .Credentials.SessionToken)

# Run the Docker command with the extracted credentials
# mount the testData folder in workspace/testData
docker run -v "$(pwd)/code:/workspace" --gpus all \
    -v "$(pwd)/testData:/workspace/testData" \
    -e QUEUE_URL="https://sqs.eu-west-2.amazonaws.com/275736403632/amplify-d2akirfrcp5tqu-prod-branc-GpuAutoProcessorProcessingQueue37-LFTxZqvcBQzo"\
    -e REGION="eu-west-2"\
    -e BUCKET="amplify-d2akirfrcp5tqu-prod-b-inputsbucketbc59c88f-mvfrctv1s27y"\
    -e API_ENDPOINT="https://gyzipildmjay5m4ryv7rw6iujq.appsync-api.eu-west-2.amazonaws.com/graphql"\
    -e API_KEY="da2-svvbrhcbcbgydoujnntdx36zg4"\
    -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
    -e AWS_SESSION_TOKEN="$AWS_SESSION_TOKEN" \
    -it lh /bin/bash 