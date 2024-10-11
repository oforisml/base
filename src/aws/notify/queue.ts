import { sqsQueue } from "@cdktf/provider-aws";
import { Token, ITerraformDependable } from "cdktf";
import { Construct } from "constructs";
// import { Statement } from "iam-floyd";
import { SqsQueueConfig, QueuePolicy } from ".";
import { AwsBeaconBase, AwsBeaconProps } from "..";
import {
  IAwsBeaconWithPolicy,
  PolicyStatement,
  AddToResourcePolicyResult,
} from "../iam";

export interface QueueProps extends AwsBeaconProps, SqsQueueConfig {
  /**
   * Queue Name suffix to append to Grid UUID
   *
   * Queue names must be made up of only uppercase and lowercase ASCII letters,
   * numbers, underscores, and hyphens, and must be between 1 and 80 characters
   * long.
   *
   * For a FIFO (first-in-first-out) queue, the name must end with the .fifo
   * @default - No suffix
   */
  readonly nameSuffix?: string;
  /**
   * Send messages to this queue if they were unsuccessfully dequeued a number of times.
   *
   * See [AWS Docs](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html)
   *
   * @default no dead-letter queue
   *
   * {@link https://registry.terraform.io/providers/hashicorp/aws/5.68.0/docs/resources/sqs_queue#redrive_policy SqsQueue#redrive_policy}
   */
  readonly deadLetterQueue?: DeadLetterQueue;
  /**
   * The string that includes the parameters for the permissions for the dead-letter queue
   * redrive permission and which source queues can specify dead-letter queues.
   *
   * @default - All source queues can designate this queue as their dead-letter queue.
   *
   * {@link https://registry.terraform.io/providers/hashicorp/aws/5.68.0/docs/resources/sqs_queue#redrive_allow_policy SqsQueue#redrive_allow_policy}
   */
  readonly redriveAllowPolicy?: RedriveAllowPolicy;
  /**
   * Whether this a first-in-first-out (FIFO) queue.
   *
   * @default false, unless nameSuffix ends in '.fifo' or 'contentBasedDeduplication' is true.
   */
  readonly fifo?: boolean;
  /**
   * Specifies whether to enable content-based deduplication.
   *
   * During the deduplication interval (5 minutes), Amazon SQS treats
   * messages that are sent with identical content (excluding attributes) as
   * duplicates and delivers only one copy of the message.
   *
   * If you don't enable content-based deduplication and you want to deduplicate
   * messages, provide an explicit deduplication ID in your SendMessage() call.
   *
   * (Only applies to FIFO queues.)
   *
   * @default false
   */
  readonly contentBasedDeduplication?: boolean;
  /**
   * For high throughput for FIFO queues, specifies whether message deduplication
   * occurs at the message group or queue level.
   *
   * (Only applies to FIFO queues.)
   *
   * @default DeduplicationScope.QUEUE
   */
  readonly deduplicationScope?: DeduplicationScope;
  /**
   * For high throughput for FIFO queues, specifies whether the FIFO queue
   * throughput quota applies to the entire queue or per message group.
   *
   * (Only applies to FIFO queues.)
   *
   * @default FifoThroughputLimit.PER_QUEUE
   */
  readonly fifoThroughputLimit?: FifoThroughputLimit;
}

/**
 * Outputs which may be registered for output via the Grid.
 */
export interface QueueOutputs {
  /**
   * Queue name
   */
  readonly name: string;

  /**
   * Queue arn
   */
  readonly arn: string;

  /**
   * Queue url
   */
  readonly url: string;
}

/**
 * Imported or created Queue attributes
 */
export interface IQueue extends IAwsBeaconWithPolicy, ITerraformDependable {
  /** Strongly typed outputs */
  readonly queueOutputs: QueueOutputs;
  /**
   * The ARN of this queue
   * @attribute
   */
  readonly queueArn: string;
  /**
   * The URL of this queue
   * @attribute
   */
  readonly queueUrl: string;
  /**
   * The name of this queue
   * @attribute
   */
  readonly queueName: string;
  /**
   * If this queue is configured with a dead-letter queue, this is the dead-letter queue settings.
   */
  readonly deadLetterQueue?: DeadLetterQueue;
}

/**
 * The `Queue` beacon provides an [AWS SQS Queue](https://aws.amazon.com/sqs/).
 *
 * ```ts
 * new notify.Queue(spec, "MyQueue", {
 *   path: path.join(__dirname, "dist"),
 * });
 * ```
 *
 * #### Public read access
 *
 * Enable `public` read access for all the files in the bucket. Useful for hosting public files.
 *
 * ```ts
 * new storage.Bucket("MyBucket", {
 *   public: true
 * });
 * ```
 *
 * @resource aws_sqs_queue
 * @beacon-class notify.IQueue
 */
export class Queue extends AwsBeaconBase implements IQueue {
  // TODO: Add static fromLookup?
  public readonly resource: sqsQueue.SqsQueue;

  private readonly _outputs: QueueOutputs;
  public get queueOutputs(): QueueOutputs {
    return this._outputs;
  }
  public get outputs(): Record<string, any> {
    return this.queueOutputs;
  }
  public get fqn(): string {
    return this.resource.fqn;
  }

  private policy?: QueuePolicy;

  private readonly _queueNamePrefix: string;
  public get queueArn(): string {
    return this.resource.arn;
  }
  public get queueUrl(): string {
    return this.resource.url;
  }
  public get queueName(): string {
    return this.resource.name;
  }
  public readonly deadLetterQueue?: DeadLetterQueue;

  /**
   * Whether this queue is an Amazon SQS FIFO queue. If false, this is a standard queue.
   */
  public readonly fifo: boolean;

  constructor(scope: Construct, name: string, props: QueueProps) {
    super(scope, name, props);

    // TODO: support ability to specify redriveAllowPolicy separately
    // ref: https://registry.terraform.io/providers/hashicorp/aws/5.68.0/docs/resources/sqs_queue_redrive_allow_policy
    if (props.redriveAllowPolicy) {
      const { redrivePermission, sourceQueues } = props.redriveAllowPolicy;
      if (redrivePermission === RedrivePermission.BY_QUEUE) {
        if (!sourceQueues || sourceQueues.length === 0) {
          throw new Error(
            "At least one source queue must be specified when RedrivePermission is set to 'byQueue'",
          );
        }
        if (sourceQueues && sourceQueues.length > 10) {
          throw new Error(
            "Up to 10 sourceQueues can be specified. Set RedrivePermission to 'allowAll' to specify more",
          );
        }
      } else if (redrivePermission && sourceQueues) {
        throw new Error(
          "sourceQueues cannot be configured when RedrivePermission is set to 'allowAll' or 'denyAll'",
        );
      }
    }

    const fifoProps = this.determineFifoProps(props);
    this.fifo = fifoProps.fifoQueue || false;

    this._queueNamePrefix = this.gridUUID;
    if (props.nameSuffix) {
      let suffix = props.nameSuffix;
      // suffix is actualy infix
      if (props.nameSuffix.endsWith(".fifo")) {
        suffix = props.nameSuffix.slice(0, -5);
      }
      this._queueNamePrefix = `${this._queueNamePrefix}-${suffix}`;
      // 54 = 80 - 26 (tf generated suffix)
      if (
        this._queueNamePrefix.length < 1 ||
        this._queueNamePrefix.length > 54
      ) {
        throw new Error(
          `Queue name prefix must be between 1 and 54 characters long. Received: ${this._queueNamePrefix}`,
        );
      }
      if (!/^[\.\-_A-Za-z0-9]+$/.test(this._queueNamePrefix)) {
        throw new Error(
          `Queue name ${this._queueNamePrefix} can contain only letters, numbers, periods, hyphens, or underscores with no spaces.`,
        );
      }
    }

    const redrivePolicy = props.deadLetterQueue
      ? {
          deadLetterTargetArn: props.deadLetterQueue.queue.queueOutputs.arn,
          maxReceiveCount: props.deadLetterQueue.maxReceiveCount,
        }
      : undefined;

    // When `redriveAllowPolicy` is provided, `redrivePermission` defaults to allow all queues (`ALLOW_ALL`);
    const redriveAllowPolicy = props.redriveAllowPolicy
      ? {
          redrivePermission:
            props.redriveAllowPolicy.redrivePermission ??
            // When `sourceQueues` is provided in `redriveAllowPolicy`, `redrivePermission` defaults to
            // allow specified queues (`BY_QUEUE`); otherwise, it defaults to allow all queues (`ALLOW_ALL`).
            (props.redriveAllowPolicy.sourceQueues
              ? RedrivePermission.BY_QUEUE
              : RedrivePermission.ALLOW_ALL),
          sourceQueueArns: props.redriveAllowPolicy.sourceQueues?.map(
            (q) => q.queueOutputs.arn,
          ),
        }
      : undefined;

    this.resource = new sqsQueue.SqsQueue(this, "Resource", {
      ...props,
      ...fifoProps,
      redrivePolicy: redrivePolicy ? JSON.stringify(redrivePolicy) : undefined,
      redriveAllowPolicy: redriveAllowPolicy
        ? JSON.stringify(redriveAllowPolicy)
        : undefined,
      namePrefix: this._queueNamePrefix,
    });
    this.deadLetterQueue = props.deadLetterQueue;
    this._outputs = {
      name: this.resource.name,
      arn: this.resource.arn,
      url: this.resource.url,
    };
  }

  /**
   * Adds a statement to the IAM resource policy associated with this queue.
   *
   * If this queue was created in this stack (`new Queue`), a queue policy
   * will be automatically created upon the first call to `addToPolicy`.
   */
  public addToResourcePolicy(
    statement: PolicyStatement,
  ): AddToResourcePolicyResult {
    if (!this.policy) {
      this.policy = new QueuePolicy(this, "Policy", { queue: this });
    }

    if (this.policy) {
      this.policy.document.addStatements(statement);
      return { statementAdded: true, policyDependable: this.policy };
    }

    return { statementAdded: false };
  }

  /**
   * Look at the props, see if the FIFO props agree, and return the correct subset of props
   */
  private determineFifoProps(props: QueueProps): FifoProps {
    // Check if any of the signals that we have say that this is a FIFO queue.
    let fifoQueue = props.fifo;
    const nameSuffix = props.nameSuffix;
    if (
      typeof fifoQueue === "undefined" &&
      nameSuffix &&
      !Token.isUnresolved(nameSuffix) &&
      nameSuffix.endsWith(".fifo")
    ) {
      fifoQueue = true;
    }
    if (typeof fifoQueue === "undefined" && props.contentBasedDeduplication) {
      fifoQueue = true;
    }
    if (typeof fifoQueue === "undefined" && props.deduplicationScope) {
      fifoQueue = true;
    }
    if (typeof fifoQueue === "undefined" && props.fifoThroughputLimit) {
      fifoQueue = true;
    }

    // If we have a name, see that it agrees with the FIFO setting
    if (typeof nameSuffix === "string") {
      if (fifoQueue && !nameSuffix.endsWith(".fifo")) {
        throw new Error("FIFO queue names must end in '.fifo'");
      }
      if (!fifoQueue && nameSuffix.endsWith(".fifo")) {
        throw new Error("Non-FIFO queue name may not end in '.fifo'");
      }
    }

    if (props.contentBasedDeduplication && !fifoQueue) {
      throw new Error(
        "Content-based deduplication can only be defined for FIFO queues",
      );
    }

    if (props.deduplicationScope && !fifoQueue) {
      throw new Error(
        "Deduplication scope can only be defined for FIFO queues",
      );
    }

    if (props.fifoThroughputLimit && !fifoQueue) {
      throw new Error(
        "FIFO throughput limit can only be defined for FIFO queues",
      );
    }

    return {
      contentBasedDeduplication: props.contentBasedDeduplication,
      deduplicationScope: props.deduplicationScope,
      fifoThroughputLimit: props.fifoThroughputLimit,
      fifoQueue,
    };
  }
}

interface FifoProps {
  readonly fifoQueue?: boolean;
  readonly contentBasedDeduplication?: boolean;
  readonly deduplicationScope?: DeduplicationScope;
  readonly fifoThroughputLimit?: FifoThroughputLimit;
}

/**
 * Dead letter queue settings
 */
export interface DeadLetterQueue {
  /**
   * The dead-letter queue to which Amazon SQS moves messages after the value of maxReceiveCount is exceeded.
   */
  readonly queue: IQueue;

  /**
   * The number of times a message can be unsuccessfully dequeued before being moved to the dead-letter queue.
   */
  readonly maxReceiveCount: number;
}

/**
 * Permission settings for the dead letter source queue
 */
export interface RedriveAllowPolicy {
  /**
   * Permission settings for source queues that can designate this queue as their dead-letter queue.
   *
   * @default - `RedrivePermission.BY_QUEUE` if `sourceQueues` is specified,`RedrivePermission.ALLOW_ALL` otherwise.
   */
  readonly redrivePermission?: RedrivePermission;

  /**
   * Source queues that can designate this queue as their dead-letter queue.
   *
   * When `redrivePermission` is set to `RedrivePermission.BY_QUEUE`, this parameter is required.
   *
   * You can specify up to 10 source queues.
   * To allow more than 10 source queues to specify dead-letter queues, set the `redrivePermission` to
   * `RedrivePermission.ALLOW_ALL`.
   *
   * When `redrivePermission` is either `RedrivePermission.ALLOW_ALL` or `RedrivePermission.DENY_ALL`,
   * this parameter cannot be set.
   *
   * @default - Required when `redrivePermission` is `RedrivePermission.BY_QUEUE`, cannot be defined otherwise.
   */
  readonly sourceQueues?: IQueue[];
}

/**
 * The permission type that defines which source queues can specify the current queue as the dead-letter queue
 */
export enum RedrivePermission {
  /**
   * Any source queues in this AWS account in the same Region can specify this queue as the dead-letter queue
   */
  ALLOW_ALL = "allowAll",
  /**
   * No source queues can specify this queue as the dead-letter queue
   */
  DENY_ALL = "denyAll",
  /**
   * Only queues specified by the `sourceQueueArns` parameter can specify this queue as the dead-letter queue
   */
  BY_QUEUE = "byQueue",
}

/**
 * What kind of deduplication scope to apply
 */
export enum DeduplicationScope {
  /**
   * Deduplication occurs at the message group level
   */
  MESSAGE_GROUP = "messageGroup",
  /**
   * Deduplication occurs at the message queue level
   */
  QUEUE = "queue",
}

/**
 * Whether the FIFO queue throughput quota applies to the entire queue or per message group
 */
export enum FifoThroughputLimit {
  /**
   * Throughput quota applies per queue
   */
  PER_QUEUE = "perQueue",
  /**
   * Throughput quota applies per message group id
   */
  PER_MESSAGE_GROUP_ID = "perMessageGroupId",
}
