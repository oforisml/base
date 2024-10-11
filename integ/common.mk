help: ## Print out every target with a description
	@awk 'BEGIN { FS = ":.*##" } \
	/^[a-zA-Z0-9_.-]+:.*##/ { \
		target = $$1; desc = $$2; \
		if (desc ~ /^ Test/) { \
			test_targets[target] = desc; \
			test_names[++test_count] = target; \
		} else { \
			other_targets[target] = desc; \
			other_names[++other_count] = target; \
		} \
	} \
	END { \
		if (test_count > 0) { \
			print "\nTest Targets:"; \
			for (i = 1; i <= test_count; i++) { \
				t = test_names[i]; \
				printf "  \033[36m%-25s\033[0m %s\n", t, test_targets[t]; \
			} \
		} \
		if (other_count > 0) { \
			print "\nOther Targets:"; \
			for (i = 1; i <= other_count; i++) { \
				t = other_names[i]; \
				printf "  \033[36m%-25s\033[0m %s\n", t, other_targets[t]; \
			} \
		} \
	}' $(MAKEFILE_LIST)
	@echo ""
	@echo "Special pattern targets:"
	@awk '/^## %/ { sub(/^## /, "  "); print }' $(MAKEFILE_LIST)
.PHONY: help

## %-no-cleanup:              Skip cleanup step (i.e. foo-no-cleanup)
%-no-cleanup:
	SKIP_cleanup_terraform=true make $*
.PHONY: %-no-cleanup

## %-synth-only:              Skip deploy, validate, and cleanup steps (i.e. foo-synth-only)
%-synth-only:
	SKIP_deploy_terraform=true SKIP_validate=true SKIP_cleanup_terraform=true make $*
.PHONY: %-synth-only

## %-validate-only:           Skip synth and cleanup steps (i.e. foo-validate-only)
%-validate-only:
	SKIP_synth_app=true SKIP_cleanup_terraform=true make $*
.PHONY: %-validate-only

## %-cleanup-only:            Skip synth, deploy, and validate steps (i.e. foo-cleanup-only)
%-cleanup-only:
	SKIP_synth_app=true SKIP_deploy_terraform=true SKIP_validate=true make $*
.PHONY: %-cleanup-only

clean: ## clean up temporary files (tf/*, apps/cdktf.out, /tmp/go-synth-*)
	rm -rf tf/*
	rm -rf apps/cdktf.out
	rm -rf /tmp/go-synth-*
.PHONY: clean
