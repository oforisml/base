# StaticSite e2e tests

> [!IMPORTANT]
> Terratest uses compiled package from `lib` directory, run `pnpm compile` after making changes!

## Webiste Bucket test

Run terratest:

```sh
make public-website-bucket
# or
make cdn-website-bucket
```

Iterating tests, use the `SKIP_` variables for the stages defined:

- SKIP_synth_app=true to skip converting Typescript into tf Json (this will prevent running any terraform stages)
- SKIP_deploy_terraform=true to skip terraform init and apply
- SKIP_validate=true to skip terratest validation stage
- SKIP_rename_app=true to skip terratest re-synth app after renaming the environment stage
- SKIP_validate_rename=true to skip terratest rename validation stage
- SKIP_cleanup_terraform=true to skip terraform destroy

For example, to synth app and deploy it, but keep everything running for troubleshooting (skip cleanup):

```sh
SKIP_cleanup_terraform=true make public-website-bucket
```

To re-run the Validation stage(s) only

```sh
SKIP_synth_app=true SKIP_cleanup_terraform=true SKIP_rename_app=true make public-website-bucket
```

To clean up after troubleshooting (skip build/deploy, but not cleanup)

```sh
SKIP_synth_app=true SKIP_deploy_terraform=true SKIP_rename_app=true SKIP_validate=true SKIP_validate_rename=true make public-website-bucket
```

## Clean

To clean up after running tests

```console
make clean
```
