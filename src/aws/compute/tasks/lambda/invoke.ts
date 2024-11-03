import { Construct } from "constructs";
import * as compute from "../../";
import { Duration } from "../../../../duration";
import * as iam from "../../../iam";
import {
  integrationResourceArn,
  validatePatternSupported,
} from "../private/task-utils";

/**
 * Properties for invoking a Lambda function with LambdaInvoke
 */
export interface LambdaInvokeProps extends compute.TaskStateBaseProps {
  /**
   * Lambda function to invoke
   */
  readonly lambdaFunction: compute.IFunction;

  /**
   * The JSON that will be supplied as input to the Lambda function
   *
   * @default - The state input (JSON path '$')
   */
  readonly payload?: compute.TaskInput;

  /**
   * Invocation type of the Lambda function
   *
   * @default InvocationType.REQUEST_RESPONSE
   */
  readonly invocationType?: LambdaInvocationType;

  /**
   * Up to 3583 bytes of base64-encoded data about the invoking client
   * to pass to the function.
   *
   * @default - No context
   */
  readonly clientContext?: string;

  /**
   * Version or alias to invoke a published version of the function
   *
   * You only need to supply this if you want the version of the Lambda Function to depend
   * on data in the state machine state. If not, you can pass the appropriate Alias or Version object
   * directly as the `lambdaFunction` argument.
   *
   * @default - Version or alias inherent to the `lambdaFunction` object.
   */
  readonly qualifier?: string;
  // deprecate this? pass a Version or Alias object as lambdaFunction instead

  /**
   * Invoke the Lambda in a way that only returns the payload response without additional metadata.
   *
   * The `payloadResponseOnly` property cannot be used if `integrationPattern`, `invocationType`,
   * `clientContext`, or `qualifier` are specified.
   * It always uses the REQUEST_RESPONSE behavior.
   *
   * @default false
   */
  readonly payloadResponseOnly?: boolean;

  /**
   * Whether to retry on Lambda service exceptions.
   *
   * This handles `Lambda.ServiceException`, `Lambda.AWSLambdaException`,
   * `Lambda.SdkClientException`, and `Lambda.ClientExecutionTimeoutException`
   * with an interval of 2 seconds, a back-off rate
   * of 2 and 6 maximum attempts.
   *
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/bp-lambda-serviceexception.html
   *
   * @default true
   */
  readonly retryOnServiceExceptions?: boolean;
}

/**
 * Invoke a Lambda function as a Task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-lambda.html
 */
export class LambdaInvoke extends compute.TaskStateBase {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: compute.IntegrationPattern[] =
    [
      compute.IntegrationPattern.REQUEST_RESPONSE,
      compute.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    ];

  // protected readonly taskMetrics?: compute.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: compute.IntegrationPattern;

  constructor(
    scope: Construct,
    id: string,
    private readonly props: LambdaInvokeProps,
  ) {
    super(scope, id, props);
    this.integrationPattern =
      props.integrationPattern ?? compute.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(
      this.integrationPattern,
      LambdaInvoke.SUPPORTED_INTEGRATION_PATTERNS,
    );

    if (
      this.integrationPattern ===
        compute.IntegrationPattern.WAIT_FOR_TASK_TOKEN &&
      !compute.FieldUtils.containsTaskToken(props.payload)
    ) {
      throw new Error(
        "Task Token is required in `payload` for callback. Use JsonPath.taskToken to set the token.",
      );
    }

    if (
      props.payloadResponseOnly &&
      (props.integrationPattern ||
        props.invocationType ||
        props.clientContext ||
        props.qualifier)
    ) {
      throw new Error(
        "The 'payloadResponseOnly' property cannot be used if 'integrationPattern', 'invocationType', 'clientContext', or 'qualifier' are specified.",
      );
    }

    // this.taskMetrics = {
    //   metricPrefixSingular: "LambdaFunction",
    //   metricPrefixPlural: "LambdaFunctions",
    //   metricDimensions: {
    //     LambdaFunctionArn: this.props.lambdaFunction.functionArn,
    //     ...(this.props.qualifier && { Qualifier: this.props.qualifier }),
    //   },
    // };

    this.taskPolicies = [
      new iam.PolicyStatement({
        resources: [this.props.lambdaFunction.functionArn], // .resourceArnsForGrantInvoke,
        actions: ["lambda:InvokeFunction"],
      }),
    ];

    if (props.retryOnServiceExceptions ?? true) {
      // Best practice from https://docs.aws.amazon.com/step-functions/latest/dg/bp-lambda-serviceexception.html
      this.addRetry({
        errors: [
          "Lambda.ClientExecutionTimeoutException",
          "Lambda.ServiceException",
          "Lambda.AWSLambdaException",
          "Lambda.SdkClientException",
        ],
        interval: Duration.seconds(2),
        maxAttempts: 6,
        backoffRate: 2,
      });
    }
  }

  /**
   * Provides the Lambda Invoke service integration task configuration
   */
  /**
   * @internal
   */
  protected _renderTask(): any {
    if (this.props.payloadResponseOnly) {
      return {
        Resource: this.props.lambdaFunction.functionArn,
        ...(this.props.payload && {
          Parameters: compute.FieldUtils.renderObject(this.props.payload.value),
        }),
      };
    } else {
      return {
        Resource: integrationResourceArn(
          this,
          "lambda",
          "invoke",
          this.integrationPattern,
        ),
        Parameters: compute.FieldUtils.renderObject({
          FunctionName: this.props.lambdaFunction.functionArn,
          Payload: this.props.payload
            ? this.props.payload.value
            : compute.TaskInput.fromJsonPathAt("$").value,
          InvocationType: this.props.invocationType,
          ClientContext: this.props.clientContext,
          Qualifier: this.props.qualifier,
        }),
      };
    }
  }
}

/**
 * Invocation type of a Lambda
 */
export enum LambdaInvocationType {
  /**
   * Invoke the function synchronously.
   *
   * Keep the connection open until the function returns a response or times out.
   * The API response includes the function response and additional data.
   */
  REQUEST_RESPONSE = "RequestResponse",

  /**
   * Invoke the function asynchronously.
   *
   * Send events that fail multiple times to the function's dead-letter queue (if it's configured).
   * The API response only includes a status code.
   */
  EVENT = "Event",

  /**
   * Validate parameter values and verify that the user or role has permission to invoke the function.
   */
  DRY_RUN = "DryRun",
}
