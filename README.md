# Base Beacon Bundle

> [!NOTE]
> A set of base CDKTF constructs for Environment Toolkit Beacon development.

The purpose of this repository is to provide handcrafted, "AWS CDK"-like, DevX on top of the auto generated L1 resources in providers such as `@cdktf/provider-aws`.

This repository defines the core contracts for:

- `Beacon`: The implementation of a higher level (L2+) User Pattern for underlaying (L1) provider resources. (i.e. `TerraformElement` in CDKTF)
- `Spec`: The composition of Beacons. (i.e. `TerraformStack` in CDKTF). Running `et up` against a `spec` config file, instantiates it as a single `terraform state` in the E.T. Grid.

This repository also provides cloud specific implementations for the above core entities:

- `AwsSpec`: An Environment Toolkit `Spec` for AWS (single AWS Account / Region).
- `AwsBeacon`: An Environment Toolkit `Beacon` implementing a user pattern using AWS Resources.

## Restrictions

> [!IMPORTANT]
> An `AwsBeacon` can only be created in the scope of an `AwsSpec`.

### An AwsSpec is limited to a single AWS Account/Region

This allows a close mapping between Environment Toolkit specs for AWS and AWS CDK concepts. This is an acceptable simplification leveraging the advanced multi-spec orchestration features provided by the other utlities within the Environment Toolkit.

For each target AWS Account + Region (a.k.a `Environment` in AWS CDK), you must define a separate `AwsSpec`. This works exactly in the same way AWS CDK Stacks are limited to a single `Environment`.

Due to this, the `AwsSpec` has a single `terraform-provider-aws` configuration which must be provided directly in its constructor:

```typescript
new AwsSpec(scope, "MySpec", {
  providerConfig: {
    region: "us-east-1",
  },
  gridUUID: "12345678-1234",             // immutable UUID maintained by E.T. for the lifetime of the spec instance
  environmentName: "Gibraltar-Staging",  // mutable description for resource discovery
});
```

Moreover, the `alias` configuration property of the Terraform provider has been stripped out given only a single provider may exist per Spec.

> Due to [JSII Typescript Restrictions](https://aws.github.io/jsii/user-guides/lib-author/typescript-restrictions/)
> upstream `@cdktf/provider-aws.provider.AwsProviderConfig` is programatically modified via [./projenrc/aws-provider-struct-builder](./projenrc/aws-provider-config-struct-builder.ts) for ease of future maintenance.

### Resource Identifiers are managed by `et`

The Environment Toolkit is heavily focused on providing experienced Cloud adoption following hard earned lessons for long term "Day 2" operations. As such, the `et` CLI and Beacon Bundles primarly aim to decouple *Resource identity* from *Resource discovery*.

Examples of problems when trying to couple resource identity and discovery:

- The AWS Security Group `description` argument forces resource re-creation when changed. Using its `description` property to record information that is desired for resource discovery but subject to change over time therefor forces security-groups to be destroyed and recreated. Information such as `Team` or `Product Name` can change over time (Org chart changes or rebranding). Re-creating resources such as security groups causes significant IaC ripples and are often simply impossible or usually avoided (voiding the utility of `description` as a means for discovery).
- Many AWS Resources simply do not allow user-provided identifiers (i.e. Instance ID, Cloudfront Distribution ID, ... ) and Resource Identity is by design decoupled from Discovery.

> Note: The right way for resource discovery on AWS is by using Resource Tags and Resource Tag Manager. NOT Resource Identifiers.

To ensure a consistent user experience for Beacon Bundle consumers, the Environment Toolkit recommends all resource identifiers depend on a `GridUUID`, generated and passed in by the [environment toolkit CLI](https://github.com/environment-toolkit/et) or similar tool. It is the responsibility of the tool to keep these identifiers unchanged across the lifecycle of a Beacon (and all the cloud resources provisioned by the Beacon).

Refer to the [Integration testing](#integration-testing) section to see how Beacon Bundle authors can ensure their Beacons behave as expected when discovery properties are changed over time.

### IBeacon Attributes vs the IBeacon `outputs` Attribute

Beacon classes implementing the Beacon interface expose following information:

<!-- should this be handled with some magical aspect annotation on the interface attributes instead? -->
<!-- https://developer.hashicorp.com/terraform/cdktf/concepts/aspects -->
| Type                    | Purpose                                                                                                       |
|-------------------------|---------------------------------------------------------------------------------------------------------------|
| `IBeacon` attributes            | These Beacon interface attributes are meant to provide easy composition of multiple Beacons into higher level Beacons |
| The `IBeacon.outputs` attribute | The `outputs` attribute is a special `IBeacon` attribute which controls registration with the root `Spec`. `IBeacon` attributes repeated in the `outputs` attribute are exposed through the E.T. Grid for "cross-Spec" referencing. |

Example:

A certificate may expose it's Status, ARN and domain validation Options through the E.T. Grid:

```typescript
export interface CertificateOutputs {
  /**
   * Status of the certificate.
   */
  readonly status: string;

  /**
   * The ARN of the certificate.
   */
  readonly arn: string;

  /**
   * Set of domain validation objects which can be used to complete certificate validation.
   * Can have more than one element, e.g., if SANs are defined.
   *
   * Only set if DNS-validation was used.
   */
  readonly domainValidationOptions?: acmCertificate.AcmCertificateDomainValidationOptionsList;
}
```

A beacon implementing the `ICertificate` Beacon interface, will expose strongly typed outputs as well as the
`domainName` and `certificateArn` attributes.

```typescript
export interface ICertificate extends IAwsBeacon {
  /** Strongly typed certificate outputs */
  readonly certificateOutputs: CertificateOutputs;
  /**
   * Domain name of the certificate.
   */
  readonly domainName: string;
  /**
   * The ARN of the certificate.
   */
  readonly certificateArn: string;
}
```

This allows other `Spec` files to read the Certificate Outputs while providing an intuitive way to build higher level beacons using the `ICertificate` interface.

> Note: The Certificate `arn` is exposed both as `cert.certificateArn` as well as `cert.certificateOutputs.arn`.
>
> When implementing a Beacon, it is a good practice to link `outputs` fields to the underlaying Terraform resource attributes (`Tokens`) while linking interface fields to known values (non-`Tokens`).
>
> This implies the convention of using outputs to create implicit dependencies between beacons.


### Integration testing

E.T. Beacon Bundles are validated using [gruntwork-io/terratest](https://github.com/gruntwork-io/terratest).

A major part of building reliable beacons involves verification of `Day 2"-type operations such as:

- Renaming Environment, ... and other dimensions used for discovery, cost aggregation or infra analysis commonly required by organisations over time.
- Adding or removing properties to existing resources with clear expectations of the blast radius.

As such, the integration framework provided by E.T. provides utility functions to test for these scenarios.

Refer to [integ/](./integ/README.md) for further details.
