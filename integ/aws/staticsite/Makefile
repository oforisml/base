clean:
	rm -rf tf/*
	rm -rf apps/cdktf.out
	rm -rf /tmp/go-synth-*
.PHONY: clean

public-website-bucket:
	go test -v -timeout 15m ./... -run ^TestPublicWebsiteBucket$
.PHONY: public-website-bucket

cdn-website-bucket:
	go test -v -timeout 45m ./... -run ^TestCdnWebsiteBucket$
.PHONY: cdn-website-bucket
