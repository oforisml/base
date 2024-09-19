clean:
	rm -rf tf/*
	rm -rf apps/cdktf.out
	rm -rf /tmp/go-synth-*
.PHONY: clean

url-rewrite-spa:
	go test -v -timeout 30m ./... -run ^TestUrlRewriteSpa$
.PHONY: url-rewrite-spa

kvs-jwt-verify:
	go test -v -timeout 30m ./... -run ^TestKvsJwtVerify$
.PHONY: kvs-jwt-verify

multi-zone-acm-pub-cert:
	go test -v -timeout 30m ./... -run ^TestMultiZoneAcmPubCert$
.PHONY: multi-zone-acm-pub-cert
