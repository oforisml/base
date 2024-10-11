include ../../common.mk

fifo-queue: ## Test Queue with FIFO semantics
	go test -v -timeout 30m ./... -run ^TestFifoQueue$
.PHONY: fifo-queue

dlq-queue: ## Test DLQ Queue
	go test -v -timeout 30m ./... -run ^TestDlqQueue$
.PHONY: dlq-queue
