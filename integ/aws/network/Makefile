clean:
	rm -rf tf/*
	rm -rf apps/cdktf.out
	rm -rf /tmp/go-synth-*
.PHONY: clean

simple-ipv4-vpc:
	go test -v -timeout 60m ./... -run ^TestSimpleIPv4Vpc$
.PHONY: simple-ipv4-vpc
