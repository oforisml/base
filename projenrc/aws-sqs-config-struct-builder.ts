import * as path from "path";
import { ProjenStruct, Struct } from "@mrgrain/jsii-struct-builder";
import { Component, typescript } from "projen";

/**
 * SqsQueueConfig without provider, name, and namePrefix
 */
export class SqsQueueConfigStructBuilder extends Component {
  constructor(project: typescript.TypeScriptProject) {
    super(project);
    const struct = new ProjenStruct(project, {
      name: "SqsQueueConfig",
      description:
        "Config for external source (like an EventBridge Rule, SNS, or S3) permission to access the Lambda function",
      filePath: path.join(
        project.srcdir,
        "aws",
        "notify",
        "queue-config.generated.ts",
      ),
    });

    struct
      .mixin(Struct.fromFqn("@cdktf/provider-aws.sqsQueue.SqsQueueConfig"))
      .omit(
        "id",
        "provider",
        "name",
        "namePrefix",
        // provide strongly typed properties for redrive and fifo
        "redrivePolicy",
        "redriveAllowPolicy",
        "fifoQueue",
        "fifoThroughputLimit",
        "contentBasedDeduplication",
        "deduplicationScope",
      );
  }
}
