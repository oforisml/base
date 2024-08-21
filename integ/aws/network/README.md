# Network e2e tests

> [!WARNING]
> Make sure to build with `pnpm build` before running e2e.
> terratest only uses the compiled `lib` folder.

Run terratest:

```sh
go test -v -timeout 40m ./... -run ^TestSimpleIPv4Vpc$
```

Iterating tests, use the `SKIP_` variables for the stages defined:

- SKIP_synth_app=true to skip converting Typescript into tf Json (fails subsequent stages)
- SKIP_deploy_terraform=true to skip terraform init and apply
- SKIP_validate=true to skip terratest validation stage
- SKIP_cleanup_terraform=true to skip terraform destroy (targetted)

> [!WARNING]
> AWS Lambda VPC network optimizations cause destroy actions on the VPC to take up to 45 min (actual 20min on average).

For example, to synth app and deploy it, but keep everything running for troubleshooting (skip cleanup):

```sh
SKIP_cleanup_terraform=true go test -v -timeout 40m ./... -run ^TestSimpleIPv4Vpc$
```

To re-run the Validation stage only

```sh
SKIP_synth_app=true SKIP_cleanup_terraform=true go test -v -timeout 40m ./... -run ^TestSimpleIPv4Vpc$
```

To clean up after troubleshooting (skip build/deploy, but not cleanup)

```sh
SKIP_synth_app=true SKIP_deploy_terraform=true SKIP_validate=true go test -v -timeout 40m ./... -run ^TestSimpleIPv4Vpc$
```

To synth app only

```sh
SKIP_deploy_terraform=true SKIP_validate=true SKIP_cleanup_terraform=true go test -v -timeout 40m ./... -run ^TestSimpleIPv4Vpc$
```
