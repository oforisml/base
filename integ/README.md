# Integration Tests

> [!WARNING]
> Make sure to build with `pnpm build` before running e2e.
> terratest only uses the compiled `lib` folder.

[terratest.gruntwork.io](https://terratest.gruntwork.io/) is a golang library of modules for IaC testing.

Refer to [Quick Start](https://terratest.gruntwork.io/docs/getting-started/quick-start/) docs.

Launch an Authenticated AWS Shell.

Run all e2e tests:

```sh
go test -v -timeout 60m ./...
```

> [!IMPORTANT]
> Running all e2e tests will take significant amount of time and is not recommended
