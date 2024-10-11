// ~~ Generated by projen. To modify, edit .projenrc.ts and run "npx projen".
import type { FileProvisioner, IResolvable, ITerraformDependable, ITerraformIterator, LocalExecProvisioner, RemoteExecProvisioner, SSHProvisionerConnection, TerraformCount, TerraformResourceLifecycle, WinrmProvisionerConnection } from 'cdktf';

/**
 * Config for external source (like an EventBridge Rule, SNS, or S3) permission to access the Lambda function
 */
export interface SqsQueueConfig {
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.68.0/docs/resources/sqs_queue#visibility_timeout_seconds SqsQueue#visibility_timeout_seconds}.
   * @stability stable
   */
  readonly visibilityTimeoutSeconds?: number;
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.68.0/docs/resources/sqs_queue#tags_all SqsQueue#tags_all}.
   * @stability stable
   */
  readonly tagsAll?: Record<string, string>;
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.68.0/docs/resources/sqs_queue#tags SqsQueue#tags}.
   * @stability stable
   */
  readonly tags?: Record<string, string>;
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.68.0/docs/resources/sqs_queue#sqs_managed_sse_enabled SqsQueue#sqs_managed_sse_enabled}.
   * @stability stable
   */
  readonly sqsManagedSseEnabled?: boolean | IResolvable;
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.68.0/docs/resources/sqs_queue#receive_wait_time_seconds SqsQueue#receive_wait_time_seconds}.
   * @stability stable
   */
  readonly receiveWaitTimeSeconds?: number;
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.68.0/docs/resources/sqs_queue#policy SqsQueue#policy}.
   * @stability stable
   */
  readonly policy?: string;
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.68.0/docs/resources/sqs_queue#message_retention_seconds SqsQueue#message_retention_seconds}.
   * @stability stable
   */
  readonly messageRetentionSeconds?: number;
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.68.0/docs/resources/sqs_queue#max_message_size SqsQueue#max_message_size}.
   * @stability stable
   */
  readonly maxMessageSize?: number;
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.68.0/docs/resources/sqs_queue#kms_master_key_id SqsQueue#kms_master_key_id}.
   * @stability stable
   */
  readonly kmsMasterKeyId?: string;
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.68.0/docs/resources/sqs_queue#kms_data_key_reuse_period_seconds SqsQueue#kms_data_key_reuse_period_seconds}.
   * @stability stable
   */
  readonly kmsDataKeyReusePeriodSeconds?: number;
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.68.0/docs/resources/sqs_queue#delay_seconds SqsQueue#delay_seconds}.
   * @stability stable
   */
  readonly delaySeconds?: number;
  /**
   * @stability experimental
   */
  readonly provisioners?: Array<FileProvisioner | LocalExecProvisioner | RemoteExecProvisioner>;
  /**
   * @stability experimental
   */
  readonly lifecycle?: TerraformResourceLifecycle;
  /**
   * @stability experimental
   */
  readonly forEach?: ITerraformIterator;
  /**
   * @stability experimental
   */
  readonly dependsOn?: Array<ITerraformDependable>;
  /**
   * @stability experimental
   */
  readonly count?: number | TerraformCount;
  /**
   * @stability experimental
   */
  readonly connection?: SSHProvisionerConnection | WinrmProvisionerConnection;
}
