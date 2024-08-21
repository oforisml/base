import { Construct } from "constructs";
import { AwsBeaconBase, Arn } from "../";

/**
 * A managed policy
 */
export interface IManagedPolicy {
  /**
   * The ARN of the managed policy
   * @attribute
   */
  readonly managedPolicyArn: string;
  /** Reference to logical id */
  readonly id: string;
}

/**
 * Import a managed policy from one of the policies that AWS manages.
 *
 * For this managed policy, you only need to know the name to be able to use it.
 *
 * Some managed policy names start with "service-role/", some start with
 * "job-function/", and some don't start with anything. Include the
 * prefix when constructing this object.
 */
export class AwsManagedPolicy extends AwsBeaconBase implements IManagedPolicy {
  private readonly managedPolicyName: string;
  private readonly _managedPolicyArn: string;
  private readonly _id: string;

  public get outputs(): Record<string, any> {
    return {
      arn: this._managedPolicyArn,
    };
  }

  public get managedPolicyArn() {
    return this._managedPolicyArn;
  }
  public get id() {
    return this._id;
  }

  constructor(scope: Construct, id: string, managedPolicyName: string) {
    super(scope, id, {});
    this._id = id;
    this.managedPolicyName = managedPolicyName;
    this._managedPolicyArn = Arn.format({
      partition: this.env.partition,
      service: "iam",
      region: "", // no region for managed policy
      account: "aws", // the account for a managed policy is 'aws'
      resource: "policy",
      resourceName: this.managedPolicyName,
    });
  }
}
