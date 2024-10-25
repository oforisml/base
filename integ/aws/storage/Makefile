include ../../common.mk

bucket-notifications: ## Test S3 Bucket with EventBridge Notifications
	go test -v -count 1 -timeout 15m ./... -run ^TestBucketNotifications$
.PHONY: bucket-notifications
