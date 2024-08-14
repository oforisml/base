# Base

> [!NOTE]
> A set of base CDKTF constructs to use in Environment Toolkit specs.

The purpose is to build handcrafted, AWS CDK like, DevX on top of the L0 `@cdktf/provider-aws` resources.

## Restrictions

> [!IMPORTANT]
> An `AwsBeacon` can only be created within an `AwsSpec`.

### An AwsSpec is limited to a single AWS Account/Region

This allows a close mapping between environment-toolkit specs for AWS and AWS CDK concepts, simplifying configuration at a trade-off for more complicated multi stack orchestration managed by the environment-toolkit.

For each target AWS Account and Region (defined as "Environment"), you must define a separate `AwsSpec` in the same way AWS CDK Stacks are limited to a single `Environment`.

Due to this, the `AwsSpec` has a single terraform aws provider configuration which must be provided in its constructor.

Also, `alias` configuration of the Terraform provider has been stripped out.

> Due to [JSII Typescript Restrictions](https://aws.github.io/jsii/user-guides/lib-author/typescript-restrictions/)
> upstream `@cdktf/provider-aws.provider.AwsProviderConfig` is programatically modified via [./projenrc/aws-provider-struct-builder](./projenrc/aws-provider-struct-builder.ts) for future maintenance.

## Resource Identifiers are managed by `et`

To decouple identities from discoverability, all resource identifiers must be provided by the [environment toolkit CLI](https://github.com/environment-toolkit/et).
