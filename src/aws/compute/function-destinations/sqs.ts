import { Construct } from "constructs";
import * as compute from "..";
import * as notify from "../../notify";

/**
 * Use a SQS queue as a Lambda destination
 */
export class SqsDestination implements compute.IDestination {
  constructor(private readonly queue: notify.IQueue) {}

  /**
   * Returns a destination configuration
   */
  public bind(
    _scope: Construct,
    fn: compute.IFunction,
    _options?: compute.DestinationOptions,
  ): compute.DestinationConfig {
    // deduplicated automatically
    this.queue.grantSendMessages(fn);

    return {
      destination: this.queue.queueArn,
    };
  }
}
