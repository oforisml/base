import * as compute from "..";
import * as storage from "../../storage";
import * as notifs from "../../storage/notification-targets";

export interface S3EventSourceProps {
  /**
   * The s3 event types that will trigger the notification.
   */
  readonly events: storage.EventType[];

  /**
   * S3 object key filter rules to determine which objects trigger this event.
   * Each filter must include a `prefix` and/or `suffix` that will be matched
   * against the s3 object key. Refer to the S3 Developer Guide for details
   * about allowed filter rules.
   */
  readonly filters?: storage.NotificationKeyFilter[];
}

/**
 * Use S3 bucket notifications as an event source for AWS Lambda.
 */
export class S3EventSource implements compute.IEventSource {
  constructor(
    private readonly bucket: storage.IBucket,
    private readonly props: S3EventSourceProps,
  ) {}

  public bind(target: compute.IFunction) {
    const filters = this.props.filters || [];
    for (const event of this.props.events) {
      this.bucket.addEventNotification(
        event,
        new notifs.FunctionDestination(target),
        ...filters,
      );
    }
  }
}
