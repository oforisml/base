import { Testing } from "cdktf";
import { render } from "./private/render-util";
import { compute, AwsSpec } from "../../../src/aws";

const gridUUID = "123e4567-e89b-12d3";
describe("Parallel State", () => {
  let spec: AwsSpec;
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
  });
  test("State Machine With Parallel State", () => {
    // WHEN
    const parallel = new compute.Parallel(spec, "Parallel State");
    parallel.branch(
      new compute.Pass(spec, "Branch 1", { stateName: "first-pass-state" }),
    );
    parallel.branch(new compute.Pass(spec, "Branch 2"));

    // THEN
    expect(render(spec, parallel)).toStrictEqual({
      StartAt: "Parallel State",
      States: {
        "Parallel State": {
          Type: "Parallel",
          End: true,
          Branches: [
            {
              StartAt: "first-pass-state",
              States: { "first-pass-state": { Type: "Pass", End: true } },
            },
            {
              StartAt: "Branch 2",
              States: { "Branch 2": { Type: "Pass", End: true } },
            },
          ],
        },
      },
    });
  });

  test("State Machine With Parallel State and ResultSelector", () => {
    // WHEN
    const parallel = new compute.Parallel(spec, "Parallel State", {
      resultSelector: {
        buz: "buz",
        baz: compute.JsonPath.stringAt("$.baz"),
      },
    });
    parallel.branch(new compute.Pass(spec, "Branch 1"));

    // THEN
    expect(render(spec, parallel)).toStrictEqual({
      StartAt: "Parallel State",
      States: {
        "Parallel State": {
          Type: "Parallel",
          End: true,
          Branches: [
            {
              StartAt: "Branch 1",
              States: { "Branch 1": { Type: "Pass", End: true } },
            },
          ],
          ResultSelector: {
            buz: "buz",
            "baz.$": "$.baz",
          },
        },
      },
    });
  });
});
