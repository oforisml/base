import { Testing } from "cdktf";
import { render } from "./private/render-util";
import { compute, AwsSpec } from "../../../src/aws";

const gridUUID = "123e4567-e89b-12d3";
describe("Fail State", () => {
  let spec: AwsSpec;
  let stateJson: any;

  beforeEach(() => {
    // GIVEN
    spec = new AwsSpec(Testing.app(), `TestSpec`, {
      environmentName: "Test",
      gridUUID,
      providerConfig: {
        region: "us-east-1",
      },
      gridBackendConfig: {
        address: "http://localhost:3000",
      },
    });
    stateJson = {
      Type: "Task",
      Resource: "arn:aws:states:::dynamodb:putItem",
      Parameters: {
        TableName: "MyTable",
        Item: {
          id: {
            S: "MyEntry",
          },
        },
      },
      ResultPath: null,
    };
  });

  test("Props are optional", () => {
    new compute.Fail(spec, "Fail");
  });

  test("can add a fail state to the chain with custom state name", () => {
    // WHEN
    const definition = new compute.CustomState(spec, "Custom1", {
      stateJson,
    })
      .next(new compute.Pass(spec, "MyPass"))
      .next(
        new compute.Fail(spec, "Fail", {
          stateName: "my-fail-state",
          comment: "failing state",
          errorPath: compute.JsonPath.stringAt("$.error"),
          causePath: compute.JsonPath.stringAt("$.cause"),
        }),
      );

    // THEN
    expect(render(spec, definition)).toStrictEqual({
      StartAt: "Custom1",
      States: {
        Custom1: {
          Next: "MyPass",
          Type: "Task",
          ...stateJson,
        },
        MyPass: {
          Type: "Pass",
          Next: "my-fail-state",
        },
        "my-fail-state": {
          Comment: "failing state",
          Type: "Fail",
          CausePath: "$.cause",
          ErrorPath: "$.error",
        },
      },
    });
  });
});
