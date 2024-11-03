import { Construct } from "constructs";
import * as compute from "../../";
import * as iam from "../../../iam";
// import { IKey } from "../../../encryption";
// import { CustomerManagedEncryptionConfiguration } from "../../customer-managed-key-encryption-configuration";

/**
 * Properties for invoking an Activity worker
 */
export interface StepFunctionsInvokeActivityProps
  extends compute.TaskStateBaseProps {
  /**
   * Step Functions Activity to invoke
   */
  readonly activity: compute.IActivity;

  /**
   * Parameters pass a collection of key-value pairs, either static values or JSONPath expressions that select from the input.
   *
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/input-output-inputpath-params.html#input-output-parameters
   *
   * @default No parameters
   */
  readonly parameters?: { [name: string]: any };
}

/**
 * A Step Functions Task to invoke an Activity worker.
 *
 * An Activity can be used directly as a Resource.
 */
export class StepFunctionsInvokeActivity extends compute.TaskStateBase {
  // protected readonly taskMetrics?: compute.TaskMetricsConfig;
  // No IAM permissions necessary unless the Activity uses a customer managed KMS key
  protected readonly taskPolicies?: iam.PolicyStatement[];

  constructor(
    scope: Construct,
    id: string,
    private readonly props: StepFunctionsInvokeActivityProps,
  ) {
    super(scope, id, props);

    // if (
    //   this.props.activity.encryptionConfiguration instanceof
    //   CustomerManagedEncryptionConfiguration
    // ) {
    //   this.taskPolicies = this.createPolicyStatements(
    //     this.props.activity.encryptionConfiguration.kmsKey,
    //   );
    // }
    // this.taskMetrics = {
    //   metricDimensions: { ActivityArn: this.props.activity.activityArn },
    //   metricPrefixSingular: "Activity",
    //   metricPrefixPlural: "Activities",
    // };
  }

  /**
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: this.props.activity.activityArn,
      Parameters: this.props.parameters
        ? compute.FieldUtils.renderObject(this.props.parameters)
        : undefined,
    };
  }

  // // IAM policy for the State Machine execution role to use the Activity KMS key when encrypting inputs
  // private createPolicyStatements(kmskey: IKey): iam.PolicyStatement[] {
  //   return [
  //     new iam.PolicyStatement({
  //       actions: ["kms:Decrypt", "kms:GenerateDataKey"],
  //       resources: [`${kmskey.keyArn}`],
  //       condition: [
  //         {
  //           test: "StringEquals",
  //           variable: "kms:EncryptionContext:aws:states:activityArn",
  //           values: [this.props.activity.activityArn],
  //         },
  //       ],
  //     }),
  //   ];
  // }
}
