include ../../common.mk

call-aws-service: ## Test StateMachine call AWS Service
	go test -v -count 1 -timeout 15m ./... -run ^TestCallAwsService$
.PHONY: call-aws-service
