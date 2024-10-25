import {
  DlqDestinationConfig,
  IEventSourceDlq,
  IEventSourceMapping,
  IFunction,
} from "../";
import * as storage from "../../storage";

/**
 * An S3 dead letter bucket destination configuration for a Lambda event source
 */
export class S3OnFailureDestination implements IEventSourceDlq {
  constructor(private readonly bucket: storage.IBucket) {}

  /**
   * Returns a destination configuration for the DLQ
   */
  public bind(
    _target: IEventSourceMapping,
    targetHandler: IFunction,
  ): DlqDestinationConfig {
    this.bucket.grantReadWrite(targetHandler);

    return {
      destination: this.bucket.bucketArn,
    };
  }
}
