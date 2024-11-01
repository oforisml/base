include ../../common.mk

all: ## Test all Stepfunctions
	go test -v -timeout 30m ./...
.PHONY: all

call-aws-service: ## Test StateMachine call AWS Service
	go test -v -count 1 -timeout 15m ./... -run ^TestCallAwsService$
.PHONY: call-aws-service

call-aws-service-sfn: ## Test StateMachine call child State Machine
	go test -v -count 1 -timeout 15m ./... -run ^TestCallAwsServiceSfn$
.PHONY: call-aws-service-sfn

call-aws-service-mwaa: ## Test StateMachine call to Managed Airflow
	go test -v -count 1 -timeout 15m ./... -run ^TestCallAwsServiceSfn$
.PHONY: call-aws-service-mwaa
