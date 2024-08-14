import {
  dataAwsAvailabilityZones,
  dataAwsCallerIdentity,
  dataAwsPartition,
  dataAwsRegion,
  provider,
} from "@cdktf/provider-aws";
import {
  TerraformStack,
  TerraformIterator,
  Token,
  Fn,
  ResourceTerraformIterator,
} from "cdktf";
import { Construct, IConstruct } from "constructs";
import { Arn, ArnComponents, ArnFormat, AwsProviderConfig } from ".";

const AWS_SPEC_SYMBOL = Symbol.for("@envtio/base/lib/aws/AwsSpec");

export interface AwsSpecProps {
  /**
   * The AWS Provider configuration (without the alias field)
   */
  readonly providerConfig: AwsProviderConfig;
}

export interface IAwsSpec {
  /**
   * The AWS Region for the beacon
   */
  readonly region: string;
  /**
   * The AWS Account for the beacon
   */
  readonly account: string;
  /**
   * The AWS Partition for the beacon
   */
  readonly partition: string;
  // /**
  //  * Produce the Token's value at resolution time
  //  */
  // resolve<T>(obj: T): T;
}

interface AwsLookup {
  awsProvider: provider.AwsProvider;
  dataAwsRegion?: dataAwsRegion.DataAwsRegion;
  dataAwsCallerIdentity?: dataAwsCallerIdentity.DataAwsCallerIdentity;
  dataAwsPartition?: dataAwsPartition.DataAwsPartition;
  dataAwsAvailabilityZones?: dataAwsAvailabilityZones.DataAwsAvailabilityZones;
}

/**
 * A Terraform stack constrained to a single AWS Account/Region to simulate CFN behavior.
 */
export class AwsSpec extends TerraformStack implements IAwsSpec {
  // ref: https://github.com/aws/aws-cdk/blob/v2.150.0/packages/aws-cdk-lib/core/lib/stack.ts#L204

  /**
   * Return whether the given object is a Stack.
   *
   * attribute detection since as 'instanceof' potentially fails across Library releases.
   */
  public static isAwsSpec(x: any): x is AwsSpec {
    return x !== null && typeof x === "object" && AWS_SPEC_SYMBOL in x;
  }

  // ref: https://github.com/aws/aws-cdk/blob/v2.150.0/packages/aws-cdk-lib/core/lib/stack.ts#L212

  /**
   * Looks up the first stack scope in which `construct` is defined. Fails if there is no stack up the tree or the stack is not an AwsBeacon.
   * @param construct The construct to start the search from.
   */
  public static ofAwsBeacon(construct: IConstruct): AwsSpec {
    const s = TerraformStack.of(construct);
    if (AwsSpec.isAwsSpec(s)) {
      return s;
    }
    throw new Error(
      `Resource '${construct.constructor?.name}' at '${construct.node.path}' should be created in the scope of an AwsBeacon, but no AwsBeacon found`,
    );
  }

  private readonly lookup: AwsLookup;

  constructor(scope: Construct, id: string, props: AwsSpecProps) {
    super(scope, id);
    this.lookup = {
      awsProvider: new provider.AwsProvider(
        this,
        "defaultAwsProvider",
        props.providerConfig,
      ),
    };
    Object.defineProperty(this, AWS_SPEC_SYMBOL, { value: true });
  }

  public get provider(): provider.AwsProvider {
    return this.lookup.awsProvider;
  }

  /**
   * Get the Region of the AWS Stack
   */
  public get region(): string {
    if (this.lookup.awsProvider.region) {
      return this.lookup.awsProvider.region;
    }
    if (!this.lookup.dataAwsRegion) {
      this.lookup.dataAwsRegion = new dataAwsRegion.DataAwsRegion(
        this,
        "Region",
        {
          provider: this.lookup.awsProvider,
        },
      );
    }
    return this.lookup.dataAwsRegion.name;
  }

  private get dataAwsCallerIdentity(): dataAwsCallerIdentity.DataAwsCallerIdentity {
    if (!this.lookup.dataAwsCallerIdentity) {
      this.lookup.dataAwsCallerIdentity =
        new dataAwsCallerIdentity.DataAwsCallerIdentity(
          this,
          "CallerIdentity",
          {
            provider: this.lookup.awsProvider,
          },
        );
    }
    return this.lookup.dataAwsCallerIdentity;
  }

  private get dataAwsAvailabilityZones(): dataAwsAvailabilityZones.DataAwsAvailabilityZones {
    if (!this.lookup.dataAwsAvailabilityZones) {
      this.lookup.dataAwsAvailabilityZones =
        new dataAwsAvailabilityZones.DataAwsAvailabilityZones(
          this,
          "AvailabilityZones",
          {
            provider: this.lookup.awsProvider,
          },
        );
    }
    return this.lookup.dataAwsAvailabilityZones;
  }

  private get dataAwsPartition(): dataAwsPartition.DataAwsPartition {
    if (!this.lookup.dataAwsPartition) {
      this.lookup.dataAwsPartition = new dataAwsPartition.DataAwsPartition(
        this,
        "Partitition",
        {
          provider: this.lookup.awsProvider,
        },
      );
    }
    return this.lookup.dataAwsPartition;
  }

  /**
   * Get the Region of the AWS Stack
   *
   * @param alias optional alias of the provider to get the account id for
   */
  public get account(): string {
    return this.dataAwsCallerIdentity.accountId;
  }

  public get partition() {
    return this.dataAwsPartition.partition;
  }

  /**
   * Base DNS domain name for the current partition (e.g., amazonaws.com in AWS Commercial, amazonaws.com.cn in AWS China).
   */
  public get urlSuffix() {
    return this.dataAwsPartition.dnsSuffix;
  }

  /**
   * Creates an ARN from components.
   *
   * If `partition`, `region` or `account` are not specified, the stack's
   * partition, region and account will be used.
   *
   * If any component is the empty string, an empty string will be inserted
   * into the generated ARN at the location that component corresponds to.
   *
   * The ARN will be formatted as follows:
   *
   *   arn:{partition}:{service}:{region}:{account}:{resource}{sep}{resource-name}
   *
   * The required ARN pieces that are omitted will be taken from the stack that
   * the 'scope' is attached to. If all ARN pieces are supplied, the supplied scope
   * can be 'undefined'.
   */
  public formatArn(components: ArnComponents): string {
    return Arn.format(components, this);
  }

  /**
   * Given an ARN, parses it and returns components.
   *
   * IF THE ARN IS A CONCRETE STRING...
   *
   * ...it will be parsed and validated. The separator (`sep`) will be set to '/'
   * if the 6th component includes a '/', in which case, `resource` will be set
   * to the value before the '/' and `resourceName` will be the rest. In case
   * there is no '/', `resource` will be set to the 6th components and
   * `resourceName` will be set to the rest of the string.
   *
   * IF THE ARN IS A TOKEN...
   *
   * ...it cannot be validated, since we don't have the actual value yet at the
   * time of this function call. You will have to supply `sepIfToken` and
   * whether or not ARNs of the expected format usually have resource names
   * in order to parse it properly. The resulting `ArnComponents` object will
   * contain tokens for the subexpressions of the ARN, not string literals.
   *
   * If the resource name could possibly contain the separator char, the actual
   * resource name cannot be properly parsed. This only occurs if the separator
   * char is '/', and happens for example for S3 object ARNs, IAM Role ARNs,
   * IAM OIDC Provider ARNs, etc. To properly extract the resource name from a
   * Tokenized ARN, you must know the resource type and call
   * `Arn.extractResourceName`.
   *
   * @param arn The ARN string to parse
   * @param sepIfToken The separator used to separate resource from resourceName
   * @param hasName Whether there is a name component in the ARN at all. For
   * example, SNS Topics ARNs have the 'resource' component contain the topic
   * name, and no 'resourceName' component.
   *
   * @returns an ArnComponents object which allows access to the various
   * components of the ARN.
   *
   * @returns an ArnComponents object which allows access to the various
   *      components of the ARN.
   *
   * @deprecated use splitArn instead
   */
  public parseArn(
    arn: string,
    sepIfToken: string = "/",
    hasName: boolean = true,
  ): ArnComponents {
    return Arn.parse(arn, sepIfToken, hasName);
  }

  /**
   * Splits the provided ARN into its components.
   * Works both if 'arn' is a string like 'arn:aws:s3:::bucket',
   * and a Token representing a dynamic CloudFormation expression
   * (in which case the returned components will also be dynamic CloudFormation expressions,
   * encoded as Tokens).
   *
   * @param arn the ARN to split into its components
   * @param arnFormat the expected format of 'arn' - depends on what format the service 'arn' represents uses
   */
  public splitArn(arn: string, arnFormat: ArnFormat): ArnComponents {
    return Arn.split(arn, arnFormat);
  }

  /**
   * Returns iterator for all AZs that are available in the AWS environment
   * (account/region) associated with this stack (default or aliased provider).
   *
   * this will return a cdktf iterator
   *
   * https://developer.hashicorp.com/terraform/cdktf/concepts/iterators#define-iterators
   *
   * To specify a different strategy for selecting availability zones override this method.
   */
  public get availabilityZoneIterator(): ResourceTerraformIterator {
    const azs = this.dataAwsAvailabilityZones;
    return TerraformIterator.fromDataSources(azs);
  }

  /**
   * Returns a Token as List of AZ names that are available in the stack's
   * AWS environment (account/region).
   *
   * The list is slized by `maxCount` which defaults to 2.
   *
   * Note: Must use `Fn.Index` to access the AZ names.
   *
   * @param maxCount the maximum number of AZs to return
   */
  public availabilityZones(maxCount: number = 2): string[] {
    const azs = this.dataAwsAvailabilityZones;
    return Token.asList(Fn.slice(azs.names, 0, maxCount));
  }

  // /**
  //  * Resolve a tokenized value in the context of the current stack.
  //  */
  // public resolve<T>(obj: T): T {
  //   // ref: https://github.com/hashicorp/terraform-cdk/blob/v0.20.7/packages/cdktf/lib/terraform-stack.ts#L151
  //   // ref: https://github.com/aws/aws-cdk/blob/v2.150.0/packages/aws-cdk-lib/core/lib/stack.ts#L572
  //   return resolve(this, obj);
  // }
}
