//https://github.com/aws/aws-cdk/blob/24adca3385e2321eac7e034d90a53b4290c048f1/packages/aws-cdk-lib/aws-logs/lib/policy.ts

import { CloudwatchLogResourcePolicy } from "@cdktf/provider-aws/lib/cloudwatch-log-resource-policy";
import { Construct } from "constructs";
import { AwsBeaconProps } from "../beacon";

import * as iam from "../iam";

/**
 * Properties to define CloudWatch log group resource policy
 */
export interface ResourcePolicyProps extends AwsBeaconProps {
  /**
   * Name of the log group resource policy
   * @default - Uses a unique id based on the construct path
   */
  readonly resourcePolicyName?: string;

  /**
   * Initial statements to add to the resource policy
   *
   * @default - No statements
   */
  readonly policyStatements?: iam.PolicyStatement;
}

/**
 * Resource Policy for CloudWatch Log Groups
 *
 * Policies define the operations that are allowed on this resource.
 *
 * You almost never need to define this construct directly.
 *
 * All AWS resources that support resource policies have a method called
 * `addToResourcePolicy()`, which will automatically create a new resource
 * policy if one doesn't exist yet, otherwise it will add to the existing
 * policy.
 *
 * Prefer to use `addToResourcePolicy()` instead.
 */
export class ResourcePolicy extends iam.Policy {
  /**
   * The IAM policy document for this resource policy.
   */
  public readonly document: iam.PolicyDocument;

  constructor(scope: Construct, id: string, props?: ResourcePolicyProps) {
    super(scope, id);

    // Initialize the policy document
    this.document = new iam.PolicyDocument(this, "Policy");

    // Add initial statements to the policy document if provided
    if (props?.policyStatements) {
      this.document.addStatements(props?.policyStatements);
    }

    // Define the Cloudwatch log group resource policy
    new CloudwatchLogResourcePolicy(this, "ResourcePolicy", {
      policyName: props?.resourcePolicyName ?? this.node.id,
      policyDocument: JSON.stringify(this.document),
    });
  }
}
