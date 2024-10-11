import * as path from "path";
import { ProjenStruct, Struct } from "@mrgrain/jsii-struct-builder";
import { Component, typescript } from "projen";

/**
 * CloudwatchEventRuleConfig without provider, name, and namePrefix
 *
 * also replace scheduleExpression with Schedule expression builder (from AWS CDK)
 */
export class CloudwatchEventRuleConfigStructBuilder extends Component {
  constructor(project: typescript.TypeScriptProject) {
    super(project);
    const struct = new ProjenStruct(project, {
      name: "RuleConfig",
      description: [
        "Provides an EventBridge Scheduler Schedule resource.",
        " * You can find out more about EventBridge Scheduler in the",
        " * [User Guide](https://docs.aws.amazon.com/scheduler/latest/UserGuide/what-is-scheduler.html)",
      ].join("\n"),
      filePath: path.join(
        project.srcdir,
        "aws",
        "notify",
        "rule-config.generated.ts",
      ),
    });

    struct
      .mixin(
        Struct.fromFqn(
          "@cdktf/provider-aws.cloudwatchEventRule.CloudwatchEventRuleConfig",
        ),
      )
      .omit(
        "id",
        "provider",
        "name",
        "namePrefix",
        "scheduleExpression",
        "state",
        "eventPattern",
      );
  }
}

/**
 * CloudwatchEventTargetConfig without provider, name, and namePrefix
 *
 * also replace scheduleExpression with Schedule expression builder (from AWS CDK)
 */
export class CloudwatchEventTargetConfigStructBuilder extends Component {
  constructor(project: typescript.TypeScriptProject) {
    super(project);
    const struct = new ProjenStruct(project, {
      name: "TfTargetConfig",
      description: "Provides an EventBridge Target resource.",
      filePath: path.join(
        project.srcdir,
        "aws",
        "notify",
        "tf-target-config.generated.ts",
      ),
    });

    struct
      .mixin(
        Struct.fromFqn(
          "@cdktf/provider-aws.cloudwatchEventTarget.CloudwatchEventTargetConfig",
        ),
      )
      .omit(
        "id",
        "provider",
        "rule",
        // State Machine Inputs, handled by RuleTargetInput class instead
        "inputTransformer",
        "inputPath",
        "input",
      );
  }
}
