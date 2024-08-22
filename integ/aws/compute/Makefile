clean:
	rm -rf tf/*
	rm -rf apps/cdktf.out
	rm -rf /tmp/go-synth-*
.PHONY: clean

nodejs-function-url:
	go test -v -timeout 15m ./... -run ^TestNodeJsFunctionUrl$
.PHONY: nodejs-function-url
