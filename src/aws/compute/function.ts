// source: https://github.com/cdktf-plus/cdktf-plus/blob/586aabad3ab2fb2a2e93e05ed33f94474ebe9397/packages/%40cdktf-plus/aws/lib/aws-lambda-function/index.ts
import {
  lambdaFunction,
  lambdaPermission,
  cloudwatchLogGroup,
  lambdaFunctionUrl,
  securityGroup,
  lambdaFunctionEventInvokeConfig,
  lambdaEventSourceMapping,
} from "@cdktf/provider-aws";
import {
  IResolveContext,
  Lazy,
  IResolvable,
  ITerraformDependable,
} from "cdktf";
import { Construct } from "constructs";
import { Statement } from "iam-floyd";
import {
  Architecture,
  PermissionConfig,
  UrlConfig,
  VpcConfig,
  EventSourceMappingConfig,
  EventInvokeConfig,
} from ".";
import {
  AwsBeaconBase,
  IAwsBeacon,
  AwsBeaconProps,
  AwsAccessLevels,
  RetentionDays,
} from "..";
import { Duration } from "../../";
// These are not exported due to iam-floyd not being JSII compatible
import { FloydServiceRole, IFloydServiceRole } from "../iam/floyd-service-role";
import { IQueue } from "../notify";
import { IBucket } from "../storage";

/**
 * Options to add an EventInvokeConfig to a function.
 */
export interface EventInvokeConfigOptions extends AwsBeaconProps {
  /**
   * The destination for failed invocations.
   *
   * Ensure the Lambda Function IAM Role has necessary permissions for the destination
   *
   * @default - no destination
   */
  readonly onFailure?: string; //TODO: Re-add IDestination.bind to automatically handle permissions?

  /**
   * The destination for successful invocations.
   *
   * Ensure the Lambda Function IAM Role has necessary permissions for the destination
   *
   * @default - no destination
   */
  readonly onSuccess?: string; //TODO: Re-add IDestination.bind to automatically handle permissions?

  /**
   * The maximum age of a request that Lambda sends to a function for
   * processing.
   *
   * Minimum: 60 seconds
   * Maximum: 6 hours
   *
   * @default Duration.hours(6)
   */
  readonly maxEventAge?: Duration;

  /**
   * The maximum number of times to retry when the function returns an error.
   *
   * Minimum: 0
   * Maximum: 2
   *
   * @default 2
   */
  readonly retryAttempts?: number;
}

export interface FunctionProps extends EventInvokeConfigOptions {
  /**
   * The environment variables to be passed to the Lambda function.
   */
  readonly environment?: { [key: string]: string };

  /**
   * Description of what your Lambda Function does.
   */
  readonly description?: string;

  /**
   * The system architectures compatible with this lambda function.
   * @default Architecture.X86_64
   */
  readonly architecture?: Architecture;

  /**
   * The tracing mode for the Lambda function.
   *
   * The Lambda function iam role will receive permission to
   * write to AWS X-Ray.
   *
   * @default Tracing.ACTIVE
   */
  readonly tracing?: Tracing;

  /**
   * The log retention period in days. Defaults to 7.
   */
  readonly logRetentionInDays?: RetentionDays;

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
   * The Lambda function iam role will receive permission to
   * manage ENIs within the provided network.
   *
   * When you connect a function to a VPC, it can only access resources and the internet through that VPC.
   *
   * See [VPC Settings](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html).
   */
  readonly networkConfig?: VpcConfig;

  /**
   * The SQS DLQ.
   *
   * The Lambda function iam role will receive permission to
   * send messages on this queue.
   *
   * @default - no deadletter queue
   */
  readonly deadLetterQueue?: IQueue;

  /**
   * Event sources for this function.
   *
   * You can also add event sources using `addEventSource`.
   *
   * @default - No event sources.
   */
  readonly events?: { [id: string]: EventSourceMappingConfig };

  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.60.0/docs/resources/lambda_function#reserved_concurrent_executions LambdaFunction#reserved_concurrent_executions}
   */
  readonly reservedConcurrentExecutions?: number;

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

export interface IFunction extends IAwsBeacon, ITerraformDependable {
  /** Strongly typed outputs */
  readonly functionOutputs: FunctionOutputs;
  readonly functionName: string;
  addPermission(alias: string, permission: PermissionConfig): void;
  dropPermission(alias: string): void;

  /**
   * Adds a url to this function.
   */
  addUrl(url: UrlConfig): void;

  /**
   * Add an environment variable to this function.
   */
  addEnvironment(key: string, value: string): IFunction;

  /**
   * Adds an event source to this function.
   *
   * The following example adds an SQS Queue as an event source:
   * ```
   * myFunction.addEventSource({
   *  eventSourceArn: myQueue.queueOutputs.arn,
   * });
   * ```
   */
  addEventSource(id: string, source: EventSourceMappingConfig): void;

  /**
   * Configures options for asynchronous invocation.
   */
  configureAsyncInvoke(options: EventInvokeConfig): void;

  /*
   * Give Function accesslevel permissions to bucket
   */
  bucketPermissions(
    bucket: IBucket,
    permissions: AwsAccessLevels,
    objectsKeyPattern?: any,
  ): void;

  /**
   * Give Function accesslevel permissions to queue
   */
  queuePermissions(bucket: IQueue, permissions: AwsAccessLevels): void;

  /**
   * Give Function permission to invoke another function
   *
   * (doesn't work for cross-account resources)
   * @param fn Function to invoke or arn of the function
   */
  functionInvokePermission(fn: IFunction | string): void;
}

/**
 * Provides a Lambda Function resource. Lambda allows you to trigger execution
 * of code in response to events in AWS, enabling serverless backend solutions.
 *
 * The Lambda Function itself includes source code and runtime configuration.
 *
 * This Beacon manages permissions as part of the function Principal iam policy.
 * This works for same account resources, but for cross-account resources,
 * you may need to manage access as part of the Resource iam policy.
 *
 * @resource aws_lambda_function
 * @beacon-class compute.IFunction
 */
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
  public get fqn(): string {
    return this.resource.fqn;
  }

  private readonly _functionName: string;
  public get functionName(): string {
    return this._functionName;
  }

  // TODO: Make role publicly accessible
  // requires JSII compatible iam-floyd or switch to https://www.awsiamactions.io/
  private readonly role: IFloydServiceRole;
  public readonly logGroup: cloudwatchLogGroup.CloudwatchLogGroup;
  public readonly environment: { [key: string]: string };

  private _url?: lambdaFunctionUrl.LambdaFunctionUrl;
  public get url(): lambdaFunctionUrl.LambdaFunctionUrl | undefined {
    return this._url;
  }

  private _eventSources: {
    [id: string]: lambdaEventSourceMapping.LambdaEventSourceMapping;
  } = {};
  public get eventSources(): lambdaEventSourceMapping.LambdaEventSourceMapping[] {
    return Object.values(this._eventSources);
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
      logRetentionInDays = RetentionDays.ONE_WEEK,
      memorySize = 512,
      timeout = 600,
      layers,
      reservedConcurrentExecutions,
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

    this.role = new FloydServiceRole(this, "ServiceRole", {
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
      description: props.description,
      role: this.role.arn,
      architectures: [
        // This is an array, but maximum length is 1!
        // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-lambda-function.html#cfn-lambda-function-architectures
        props.architecture?.toString() ?? Architecture.X86_64.toString(),
      ],
      memorySize,
      timeout,
      layers,
      reservedConcurrentExecutions,
      environment: {
        variables: Lazy.anyValue({
          produce: (_context: IResolveContext) => {
            return this.environment;
          },
        }) as any,
      },
      vpcConfig: this.parseVpcConfig(props.networkConfig),
      tracingConfig: this.parseTracingConfig(props.tracing ?? Tracing.ACTIVE),
      deadLetterConfig: this.parseDeadLetterConfig(props.deadLetterQueue),
      // retryAttempts: 2, // TODO: Add aws_lambda_function_event_invoke_config
      dependsOn: [logGroup],
    };

    this.resource = new lambdaFunction.LambdaFunction(
      this,
      "Resource",
      fnOptions,
    );

    for (const [id, event] of Object.entries(props.events || {})) {
      this.addEventSource(id, event);
    }

    // Event Invoke Config
    if (
      props.onFailure ||
      props.onSuccess ||
      props.maxEventAge ||
      props.retryAttempts !== undefined
    ) {
      this.configureAsyncInvoke({
        qualifier: "$LATEST",
        maximumEventAgeInSeconds: props.maxEventAge?.toSeconds(),
        maximumRetryAttempts: props.retryAttempts,
        ...(props.onFailure || props.onSuccess
          ? {
              destinationConfig: {
                ...(props.onFailure
                  ? { onFailure: { destination: props.onFailure } }
                  : undefined),
                ...(props.onSuccess
                  ? { onSuccess: { destination: props.onSuccess } }
                  : undefined),
              },
            }
          : undefined),
      });
    }

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

  // TODO: Support sns.ITopic + sns:Publish topicArn
  /**
   * Optionally create LambdaFunctionDeadLetterConfig
   */
  private parseDeadLetterConfig(
    deadLetterQueue?: IQueue,
  ): lambdaFunction.LambdaFunctionDeadLetterConfig | undefined {
    if (deadLetterQueue) {
      this.role.addPolicyStatements(
        new Statement.Sqs()
          .allow()
          .toSendMessage()
          .on(deadLetterQueue.queueOutputs.arn),
      );
      return {
        targetArn: deadLetterQueue.queueOutputs.arn,
      };
    } else {
      return undefined;
    }
  }

  private parseTracingConfig(
    tracing: Tracing,
  ): lambdaFunction.LambdaFunctionTracingConfig | undefined {
    if (tracing === undefined || tracing === Tracing.DISABLED) {
      return undefined;
    }
    this.role.addPolicyStatements(
      new Statement.Xray()
        .allow()
        .toPutTraceSegments()
        .toPutTelemetryRecords()
        .onAllResources(),
    );
    return {
      mode: tracing,
    };
  }

  public bucketPermissions(
    bucket: IBucket,
    access: AwsAccessLevels,
    objectsKeyPattern: any = "*",
  ) {
    //TODO: Add kms permissions if bucket is encrypted
    //TODO: Manage policy doc length?
    const s3Permissions = new Statement.S3()
      .allow()
      .on(bucket.bucketOutputs.arn, bucket.arnForObjects(objectsKeyPattern));
    this.addAccessLevels(s3Permissions, access);
    this.role.addPolicyStatements(s3Permissions);
  }

  public queuePermissions(queue: IQueue, access: AwsAccessLevels) {
    //TODO: Add kms permissions if queue is encrypted
    //TODO: Manage policy doc length?
    const sqsPermissions = new Statement.Sqs()
      .allow()
      .on(queue.queueOutputs.arn);
    this.addAccessLevels(sqsPermissions, access);
    this.role.addPolicyStatements(sqsPermissions);
  }

  public functionInvokePermission(fn: IFunction | string) {
    // TODO: Handle Lambda version, cross account invokes?
    const fnArn = typeof fn === "string" ? fn : fn.functionOutputs.arn;
    this.role.addPolicyStatements(
      new Statement.Lambda()
        .allow()
        .toInvokeAsync()
        .toInvokeFunction()
        .on(fnArn),
    );
  }

  private addAccessLevels(stmt: Statement.All, access: AwsAccessLevels) {
    /* eslint-disable no-bitwise */
    if (access & AwsAccessLevels.LIST) {
      stmt.allListActions();
    }
    if (access & AwsAccessLevels.READ) {
      stmt.allReadActions();
    }
    if (access & AwsAccessLevels.TAGGING) {
      stmt.allTaggingActions();
    }
    if (access & AwsAccessLevels.WRITE) {
      stmt.allWriteActions();
    }
    if (access & AwsAccessLevels.PERMISSION_MANAGEMENT) {
      stmt.allPermissionManagementActions();
    }
    /* eslint-enable no-bitwise */
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
    // TODO: Error if url already exists?
    this._url = new lambdaFunctionUrl.LambdaFunctionUrl(this, "url", {
      ...url,
      functionName: this.resource.arn,
    });
  }

  public addEventSource(id: string, source: EventSourceMappingConfig): void {
    // use crypt.createHash to generate a unique identifier for the event source instead?
    let eventSource = this._eventSources[id];
    if (!eventSource) {
      eventSource = new lambdaEventSourceMapping.LambdaEventSourceMapping(
        this,
        id,
        {
          ...source,
          functionName: this.resource.functionName,
        },
      );
      this._eventSources[id] = eventSource;
    }
  }

  public configureAsyncInvoke(options: EventInvokeConfig): void {
    if (this.node.tryFindChild("EventInvokeConfig") !== undefined) {
      throw new Error(
        `An EventInvokeConfig has already been configured for the function at ${this.node.path}`,
      );
    }

    new lambdaFunctionEventInvokeConfig.LambdaFunctionEventInvokeConfig(
      this,
      "EventInvokeConfig",
      {
        functionName: this.resource.functionName,
        ...options,
      },
    );
  }

  /**
   * Adds an environment variable to this Lambda function.
   * If this is a ref to a Lambda function, this operation results in a no-op.
   * @param key The environment variable key.
   * @param value The environment variable's value.
   */
  public addEnvironment(key: string, value: string): IFunction {
    // Reserved environment variables will fail during cloudformation deploy if they're set.
    // This check is just to allow CDK to fail faster when these are specified.
    const reservedEnvironmentVariables = [
      "_HANDLER",
      "_X_AMZN_TRACE_ID",
      "AWS_DEFAULT_REGION",
      "AWS_REGION",
      "AWS_EXECUTION_ENV",
      "AWS_LAMBDA_FUNCTION_NAME",
      "AWS_LAMBDA_FUNCTION_MEMORY_SIZE",
      "AWS_LAMBDA_FUNCTION_VERSION",
      "AWS_LAMBDA_INITIALIZATION_TYPE",
      "AWS_LAMBDA_LOG_GROUP_NAME",
      "AWS_LAMBDA_LOG_STREAM_NAME",
      "AWS_ACCESS_KEY",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_SESSION_TOKEN",
      "AWS_LAMBDA_RUNTIME_API",
      "LAMBDA_TASK_ROOT",
      "LAMBDA_RUNTIME_DIR",
    ];
    if (reservedEnvironmentVariables.includes(key)) {
      throw new Error(
        `${key} environment variable is reserved by the lambda runtime and can not be set manually. See https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html`,
      );
    }
    this.environment[key] = value;
    return this;
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
      const permissionRes = new lambdaPermission.LambdaPermission(this, id, {
        ...permission,
        functionName: this.resource.functionName,
      });
      if (permission.dependees !== undefined) {
        // node.addDependency doesn't work - see: https://github.com/hashicorp/terraform-cdk/issues/785
        // permissionRes.node.addDependency(...permission.dependees);
        for (const dependee of permission.dependees) {
          if (dependee.dependsOn !== undefined) {
            dependee.dependsOn.push(permissionRes.fqn);
          } else {
            dependee.dependsOn = [permissionRes.fqn];
          }
        }
      }
    }
    return {};
  }
}

/**
 * X-Ray Tracing Modes (https://docs.aws.amazon.com/lambda/latest/dg/API_TracingConfig.html)
 */
export enum Tracing {
  /**
   * Lambda will respect any tracing header it receives from an upstream service.
   * If no tracing header is received, Lambda will sample the request based on a fixed rate. Please see the [Using AWS Lambda with AWS X-Ray](https://docs.aws.amazon.com/lambda/latest/dg/services-xray.html) documentation for details on this sampling behavior.
   */
  ACTIVE = "Active",
  /**
   * Lambda will only trace the request from an upstream service
   * if it contains a tracing header with "sampled=1"
   */
  PASS_THROUGH = "PassThrough",
  /**
   * Lambda will not trace any request.
   */
  DISABLED = "Disabled",
}
