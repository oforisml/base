include ./common.mk


this: ## Test all integ utilities
	go test -v -count 1 .
.PHONY: this

assert: ## Test assert
	go test -v -count 1 . -run ^TestAssert
.PHONY: assert

terraform-output-jmes: ## Test terraform output with jmespath
	go test -v -count 1 . -run ^TestTerraformOutputJMES
.PHONY: terraform-output-jmes
