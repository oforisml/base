// source: https://github.com/cdktf-plus/cdktf-plus/blob/586aabad3ab2fb2a2e93e05ed33f94474ebe9397/packages/%40cdktf-plus/aws/lib/aws-lambda-function/index.ts
import {
  lambdaFunction,
  lambdaPermission,
  cloudwatchLogGroup,
  lambdaFunctionUrl,
  securityGroup,
} from "@cdktf/provider-aws";
import { IResolveContext, Lazy, IResolvable } from "cdktf";
import { Construct } from "constructs";
import { Statement } from "iam-floyd";
import { PermissionConfig, UrlConfig, VpcConfig } from ".";
import { AwsBeaconBase, IAwsBeacon, AwsBeaconProps } from "..";
import { ServiceRole, IServiceRole } from "../iam";

export interface FunctionProps extends AwsBeaconProps {
  /**
   * The environment variables to be passed to the Lambda function.
   */
  readonly environment?: { [key: string]: string };

  /**
   * The log retention period in days. Defaults to 7.
   */
  readonly logRetentionInDays?: number;

  /**
   * The memory limit in MB. Defaults to 512.
   */
  readonly memorySize?: number;

  /**
   * The timout in seconds. Defaults to 15.
   */
  readonly timeout?: number;

  /**
   * Layers for the Lambda.
   */
  readonly layers?: string[];

  /**
   * Config for network connectivity to AWS resources in a VPC, specify a list
   * of subnet, and optionally security groups, in the VPC.
   *
   * When you connect a function to a VPC, it can only access resources and the internet through that VPC.
   *
   * See [VPC Settings](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html).
   */
  readonly networkConfig?: VpcConfig;

  /**
   * Tags to apply to the Lambda function.
   */
  readonly tags?: { [key: string]: string };
}

export interface FunctionOutputs {
  /**
   * AWS Lambda function name
   */
  readonly name: string;

  /**
   * AWS Lambda arn of the function
   */
  readonly arn: string;

  /**
   * The IAM Role associated with the Lambda function
   */
  readonly role: string | IResolvable;

  /**
   * Function URL if enabled
   */
  readonly url?: string | IResolvable;

  /**
   * Security group of the function if created
   */
  readonly defaultSecurityGroup?: string | IResolvable;
}

export interface IFunction extends IAwsBeacon {
  /** Strongly typed outputs */
  readonly functionOutputs: FunctionOutputs;
  readonly functionName: string;
  addPermission(alias: string, permission: PermissionConfig): void;
  dropPermission(alias: string): void;
  addUrl(url: UrlConfig): void;
}

export class LambdaFunction extends AwsBeaconBase implements IFunction {
  // TODO: Add static fromLookup?
  protected readonly resource: lambdaFunction.LambdaFunction;

  private readonly _outputs: FunctionOutputs;
  public get functionOutputs(): FunctionOutputs {
    return this._outputs;
  }
  public get outputs(): Record<string, any> {
    return this.functionOutputs;
  }

  private readonly _functionName: string;
  public get functionName(): string {
    return this._functionName;
  }

  // TODO: Make role publicly accessible
  // requires JSII compatible iam-floyd or switch to https://www.awsiamactions.io/
  private readonly role: IServiceRole;
  public readonly logGroup: cloudwatchLogGroup.CloudwatchLogGroup;
  public readonly environment: { [key: string]: string };

  private _url?: lambdaFunctionUrl.LambdaFunctionUrl;
  public get url(): lambdaFunctionUrl.LambdaFunctionUrl | undefined {
    return this._url;
  }

  private _securityGroup?: securityGroup.SecurityGroup;
  public get securityGroup(): securityGroup.SecurityGroup | undefined {
    return this._securityGroup;
  }

  // Permissions are stored in a map to allow for easy overriding and dropping.
  // Permissions are added to the stack at Synth time.
  private readonly permissions: Record<string, PermissionConfig> = {};

  constructor(scope: Construct, name: string, props: FunctionProps) {
    super(scope, name, props);

    const {
      environment: variables,
      logRetentionInDays = 7,
      memorySize = 512,
      timeout = 600,
      layers,
    } = props;
    this.environment = variables || {};

    this._functionName = `${this.gridUUID}-${name}`;

    const logGroup = new cloudwatchLogGroup.CloudwatchLogGroup(
      this,
      "LogGroup",
      {
        name: `/aws/lambda/${this._functionName}`,
        retentionInDays: logRetentionInDays,
      },
    );

    this.logGroup = logGroup;

    this.role = new ServiceRole(this, "ServiceRole", {
      service: "lambda.amazonaws.com",
      policyStatements: [
        new Statement.Logs()
          .allow()
          .toCreateLogStream()
          .toPutLogEvents()
          .on(logGroup.arn, `${logGroup.arn}:log-stream:*`),
      ],
      tags: props.tags,
    });

    const fnOptions: lambdaFunction.LambdaFunctionConfig = {
      functionName: this._functionName,
      role: this.role.arn,
      memorySize,
      timeout,
      layers,
      environment: {
        variables: Lazy.anyValue({
          produce: (_context: IResolveContext) => {
            return this.environment;
          },
        }) as any,
      },
      vpcConfig: this.parseVpcConfig(props.networkConfig),
      dependsOn: [logGroup],
    };

    this.resource = new lambdaFunction.LambdaFunction(
      this,
      "Resource",
      fnOptions,
    );
    this._outputs = {
      name: this._functionName, // not a token
      arn: this.resource.arn,
      role: this.role.arn,
      // only known at synth time
      // explicit `null` required to avoid syntax errors when using stringValue && "undefined"
      url: Lazy.anyValue({
        produce: () => this._url?.functionUrl ?? null,
      }),
      defaultSecurityGroup: Lazy.anyValue({
        produce: () => this._securityGroup?.id ?? null,
      }),
    };
  }

  /**
   * Optionally create LambdaFunctionVpcConfig
   */
  private parseVpcConfig(
    config?: VpcConfig,
  ): lambdaFunction.LambdaFunctionVpcConfig | undefined {
    if (!config) {
      return undefined;
    }
    let securityGroupIds = config.securityGroupIds;
    if (!securityGroupIds) {
      this._securityGroup = new securityGroup.SecurityGroup(
        this,
        "SecurityGroup",
        {
          name: this._functionName,
          description: this._functionName,
          vpcId: config.vpcId,

          egress: config.egress ?? [
            {
              fromPort: 0,
              toPort: 0,
              protocol: "-1",
              cidrBlocks: ["0.0.0.0/0"],
              ipv6CidrBlocks: ["::/0"],
            },
          ],
        },
      );
      securityGroupIds = [this._securityGroup.id];
    }
    // ensure Lambda has permissions to manage ENIs
    // not sure if time.sleep is still necessary?
    // ref:
    //  - https://github.com/pulumi/pulumi-aws/issues/2260#issuecomment-1977606509
    //  - https://github.com/hashicorp/terraform-provider-aws/issues/29828#issuecomment-1693307500
    this.role.addPolicyStatements(
      new Statement.Ec2()
        .allow()
        .toCreateNetworkInterface()
        .toDescribeNetworkInterfaces()
        .toDeleteNetworkInterface()
        .toAssignPrivateIpAddresses()
        .toUnassignPrivateIpAddresses()
        .onAllResources(),
    );
    return {
      subnetIds: config.subnetIds,
      ipv6AllowedForDualStack: config.ipv6AllowedForDualStack,
      securityGroupIds,
    };
  }

  /**
   * Gives an external source (like an EventBridge Rule, SNS, or S3) permission
   * to access the Lambda function.
   */
  public addPermission(alias: string, permission: PermissionConfig) {
    this.permissions[alias] = permission;
  }

  /**
   * Ensure Lambda function permission is removed
   */
  public dropPermission(alias: string) {
    if (!this.permissions[alias]) {
      throw new Error(`Permission with id '${alias}' does not exists`);
    }
    delete this.permissions[alias];
  }

  /**
   * A function URL is a dedicated HTTP(S) endpoint for a Lambda function.
   */
  public addUrl(url: UrlConfig) {
    this._url = new lambdaFunctionUrl.LambdaFunctionUrl(this, "url", {
      ...url,
      functionName: this.resource.arn,
    });
  }

  /**
   * Adds resource to the Terraform JSON output at Synth time.
   *
   * called by TerraformStack.prepareStack()
   */
  public toTerraform(): any {
    /**
     * A preparing resolve might add new resources to the stack
     *
     * should not add resources if no permissions are defined
     */
    if (Object.keys(this.permissions).length === 0) {
      return {};
    }

    for (const [id, permission] of Object.entries(this.permissions)) {
      if (this.node.tryFindChild(id)) continue; // ignore if already generated
      new lambdaPermission.LambdaPermission(this, id, {
        ...permission,
        functionName: this.resource.functionName,
      });
    }
    return {};
  }
}
