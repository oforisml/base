import "cdktf/lib/testing/adapters/jest";
import { Testing } from "cdktf";
import * as compute from "../../../../../src/aws/compute";
import * as tasks from "../../../../../src/aws/compute/tasks";
import * as notify from "../../../../../src/aws/notify";
import { AwsSpec } from "../../../../../src/aws/spec";

let spec: AwsSpec;
let connection: notify.IConnection;

const expectTaskWithParameters = (task: tasks.HttpInvoke, parameters: any) => {
  expect(spec.resolve(task.toStateJson())).toEqual({
    Type: "Task",
    Resource:
      "arn:${data.aws_partition.Partitition.partition}:states:::http:invoke",
    // Resource: {
    //   "Fn::Join": [
    //     "",
    //     [
    //       "arn:",
    //       {
    //         Ref: "AWS::Partition",
    //       },
    //       ":states:::http:invoke",
    //     ],
    //   ],
    // },
    End: true,
    Parameters: parameters,
  });
};

describe("AWS::StepFunctions::Tasks::HttpInvoke", () => {
  beforeEach(() => {
    const app = Testing.app();
    spec = new AwsSpec(app, "TestSpec", {
      environmentName: "Test",
      gridUUID: "123e4567-e89b-12d3",
      providerConfig: { region: "us-east-1" },
      gridBackendConfig: {
        address: "http://localhost:3000",
      },
    });
    connection = new notify.Connection(spec, "Connection", {
      authorization: notify.Authorization.basic("username", "password"), // TODO: should be sensitive
      connectionName: "testConnection",
    });
  });

  test("invoke with default props", () => {
    const task = new tasks.HttpInvoke(spec, "Task", {
      apiRoot: "https://api.example.com",
      apiEndpoint: compute.TaskInput.fromText("path/to/resource"),
      connection,
      method: compute.TaskInput.fromText("POST"),
    });

    expectTaskWithParameters(task, {
      ApiEndpoint: "https://api.example.com/path/to/resource",
      Authentication: {
        ConnectionArn: spec.resolve(connection.connectionArn),
      },
      Method: "POST",
    });
  });

  test("invoke with all props", () => {
    const task = new tasks.HttpInvoke(spec, "Task", {
      apiRoot: "https://api.example.com",
      apiEndpoint: compute.TaskInput.fromText("path/to/resource"),
      connection,
      headers: compute.TaskInput.fromObject({
        "custom-header": "custom-value",
      }),
      method: compute.TaskInput.fromText("POST"),
      urlEncodingFormat: tasks.URLEncodingFormat.BRACKETS,
      queryStringParameters: compute.TaskInput.fromObject({
        foo: "bar",
      }),
    });

    expectTaskWithParameters(task, {
      ApiEndpoint: "https://api.example.com/path/to/resource",
      Authentication: {
        ConnectionArn: spec.resolve(connection.connectionArn),
      },
      Method: "POST",
      Headers: {
        "custom-header": "custom-value",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      Transform: {
        RequestBodyEncoding: "URL_ENCODED",
        RequestEncodingOptions: {
          ArrayFormat: tasks.URLEncodingFormat.BRACKETS,
        },
      },
      QueryParameters: {
        foo: "bar",
      },
    });
  });

  test("invoke with default urlEncodingFormat", () => {
    const task = new tasks.HttpInvoke(spec, "Task", {
      apiRoot: "https://api.example.com",
      apiEndpoint: compute.TaskInput.fromText("path/to/resource"),
      method: compute.TaskInput.fromText("POST"),
      connection,
      urlEncodingFormat: tasks.URLEncodingFormat.DEFAULT,
    });

    expectTaskWithParameters(task, {
      ApiEndpoint: "https://api.example.com/path/to/resource",
      Authentication: {
        ConnectionArn: spec.resolve(connection.connectionArn),
      },
      Method: "POST",
      Headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      Transform: {
        RequestBodyEncoding: "URL_ENCODED",
      },
    });
  });

  test("invoke with no urlEncodingFormat", () => {
    const task = new tasks.HttpInvoke(spec, "Task", {
      apiRoot: "https://api.example.com",
      apiEndpoint: compute.TaskInput.fromText("path/to/resource"),
      method: compute.TaskInput.fromText("POST"),
      connection,
      urlEncodingFormat: tasks.URLEncodingFormat.NONE,
    });

    expectTaskWithParameters(task, {
      ApiEndpoint: "https://api.example.com/path/to/resource",
      Authentication: {
        ConnectionArn: spec.resolve(connection.connectionArn),
      },
      Method: "POST",
    });
  });
});
