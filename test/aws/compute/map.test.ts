import { Testing } from "cdktf";
import { render } from "./private/render-util";
import { compute, AwsSpec } from "../../../src/aws";

const gridUUID = "123e4567-e89b-12d3";

describe("Map State", () => {
  describe("State Machine With Map State", () => {
    let spec: AwsSpec;
    beforeEach(() => {
      // GIVEN
      const app = Testing.app();
      spec = new AwsSpec(app, `TestSpec`, {
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
    test("simple", () => {
      // WHEN
      const map = new compute.Map(spec, "Map State", {
        stateName: "My-Map-State",
        maxConcurrency: 1,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
        parameters: {
          foo: "foo",
          bar: compute.JsonPath.stringAt("$.bar"),
        },
      });
      map.iterator(new compute.Pass(spec, "Pass State"));

      // THEN
      expect(render(spec, map)).toStrictEqual({
        StartAt: "My-Map-State",
        States: {
          "My-Map-State": {
            Type: "Map",
            End: true,
            Parameters: {
              foo: "foo",
              "bar.$": "$.bar",
            },
            Iterator: {
              StartAt: "Pass State",
              States: {
                "Pass State": {
                  Type: "Pass",
                  End: true,
                },
              },
            },
            ItemsPath: "$.inputForMap",
            MaxConcurrency: 1,
          },
        },
      });
    });

    test("and MaxConcurrencyPath", () => {
      // WHEN
      const map = new compute.Map(spec, "Map State", {
        stateName: "My-Map-State",
        maxConcurrencyPath: compute.JsonPath.stringAt("$.maxConcurrencyPath"),
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
        parameters: {
          foo: "foo",
          bar: compute.JsonPath.stringAt("$.bar"),
        },
      });
      map.iterator(new compute.Pass(spec, "Pass State"));

      // THEN
      expect(render(spec, map)).toStrictEqual({
        StartAt: "My-Map-State",
        States: {
          "My-Map-State": {
            Type: "Map",
            End: true,
            Parameters: {
              foo: "foo",
              "bar.$": "$.bar",
            },
            Iterator: {
              StartAt: "Pass State",
              States: {
                "Pass State": {
                  Type: "Pass",
                  End: true,
                },
              },
            },
            ItemsPath: "$.inputForMap",
            MaxConcurrencyPath: "$.maxConcurrencyPath",
          },
        },
      });
    });

    test("and ResultSelector", () => {
      // WHEN
      const map = new compute.Map(spec, "Map State", {
        maxConcurrency: 1,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
        resultSelector: {
          buz: "buz",
          baz: compute.JsonPath.stringAt("$.baz"),
        },
      });
      map.iterator(new compute.Pass(spec, "Pass State"));

      // THEN
      expect(render(spec, map)).toStrictEqual({
        StartAt: "Map State",
        States: {
          "Map State": {
            Type: "Map",
            End: true,
            Iterator: {
              StartAt: "Pass State",
              States: {
                "Pass State": {
                  Type: "Pass",
                  End: true,
                },
              },
            },
            ItemsPath: "$.inputForMap",
            MaxConcurrency: 1,
            ResultSelector: {
              buz: "buz",
              "baz.$": "$.baz",
            },
          },
        },
      });
    });

    test("and Item Processor", () => {
      // WHEN
      const map = new compute.Map(spec, "Map State", {
        stateName: "My-Map-State",
        maxConcurrency: 1,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
        parameters: {
          foo: "foo",
          bar: compute.JsonPath.stringAt("$.bar"),
        },
      });
      map.itemProcessor(new compute.Pass(spec, "Pass State"));

      // THEN
      expect(render(spec, map)).toStrictEqual({
        StartAt: "My-Map-State",
        States: {
          "My-Map-State": {
            Type: "Map",
            End: true,
            Parameters: {
              foo: "foo",
              "bar.$": "$.bar",
            },
            ItemProcessor: {
              ProcessorConfig: {
                Mode: "INLINE",
              },
              StartAt: "Pass State",
              States: {
                "Pass State": {
                  Type: "Pass",
                  End: true,
                },
              },
            },
            ItemsPath: "$.inputForMap",
            MaxConcurrency: 1,
          },
        },
      });
    });

    test("and Item Selector", () => {
      // WHEN
      const map = new compute.Map(spec, "Map State", {
        stateName: "My-Map-State",
        maxConcurrency: 1,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
        itemSelector: {
          foo: "foo",
          bar: compute.JsonPath.stringAt("$.bar"),
        },
      });
      map.itemProcessor(new compute.Pass(spec, "Pass State"));

      // THEN
      expect(render(spec, map)).toStrictEqual({
        StartAt: "My-Map-State",
        States: {
          "My-Map-State": {
            Type: "Map",
            End: true,
            ItemSelector: {
              foo: "foo",
              "bar.$": "$.bar",
            },
            ItemProcessor: {
              ProcessorConfig: {
                Mode: "INLINE",
              },
              StartAt: "Pass State",
              States: {
                "Pass State": {
                  Type: "Pass",
                  End: true,
                },
              },
            },
            ItemsPath: "$.inputForMap",
            MaxConcurrency: 1,
          },
        },
      });
    });

    test("and Item Processor in distributed mode", () => {
      // WHEN
      const map = new compute.Map(spec, "Map State", {
        stateName: "My-Map-State",
        maxConcurrency: 1,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
        parameters: {
          foo: "foo",
          bar: compute.JsonPath.stringAt("$.bar"),
        },
      });
      map.itemProcessor(new compute.Pass(spec, "Pass State"), {
        mode: compute.ProcessorMode.DISTRIBUTED,
        executionType: compute.ProcessorType.STANDARD,
      });

      // THEN
      expect(render(spec, map)).toStrictEqual({
        StartAt: "My-Map-State",
        States: {
          "My-Map-State": {
            Type: "Map",
            End: true,
            Parameters: {
              foo: "foo",
              "bar.$": "$.bar",
            },
            ItemProcessor: {
              ProcessorConfig: {
                Mode: "DISTRIBUTED",
                ExecutionType: "STANDARD",
              },
              StartAt: "Pass State",
              States: {
                "Pass State": {
                  Type: "Pass",
                  End: true,
                },
              },
            },
            ItemsPath: "$.inputForMap",
            MaxConcurrency: 1,
          },
        },
      });
    });
  });

  test("synth is successful with iterator", () => {
    const spec = createStackWithMap((stack) => {
      const map = new compute.Map(stack, "Map State", {
        maxConcurrency: 1,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
      });
      map.iterator(new compute.Pass(stack, "Pass State"));
      return map;
    });

    Testing.synth(spec, true);
  });

  test("synth is successful with item processor and inline mode", () => {
    const spec = createStackWithMap((stack) => {
      const map = new compute.Map(stack, "Map State", {
        maxConcurrency: 1,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
      });
      map.itemProcessor(new compute.Pass(stack, "Pass State"));
      return map;
    });

    Testing.synth(spec, true);
  });

  test("synth is successful with item selector", () => {
    const spec = createStackWithMap((stack) => {
      const map = new compute.Map(stack, "Map State", {
        maxConcurrency: 1,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
        itemSelector: {
          foo: "foo",
          bar: compute.JsonPath.stringAt("$.bar"),
        },
      });
      map.itemProcessor(new compute.Pass(stack, "Pass State"));
      return map;
    });

    Testing.synth(spec, true);
  });

  test("synth is successful with item processor and distributed mode", () => {
    const spec = createStackWithMap((stack) => {
      const map = new compute.Map(stack, "Map State", {
        maxConcurrency: 1,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
      });
      map.itemProcessor(new compute.Pass(stack, "Pass State"), {
        mode: compute.ProcessorMode.DISTRIBUTED,
        executionType: compute.ProcessorType.STANDARD,
      });
      return map;
    });

    Testing.synth(spec, true);
  });

  test("fails in synthesis if iterator and item processor are missing", () => {
    const spec = createStackWithMap((stack) => {
      const map = new compute.Map(stack, "Map State", {
        maxConcurrency: 1,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
      });

      return map;
    });

    expect(() => Testing.synth(spec, true)).toThrow(
      /Map state must either have a non-empty iterator or a non-empty item processor/,
    );
  });

  test("fails in synthesis if both iterator and item processor are defined", () => {
    const spec = createStackWithMap((stack) => {
      const map = new compute.Map(stack, "Map State", {
        maxConcurrency: 1,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
      });
      map.iterator(new compute.Pass(stack, "Pass State 1"));
      map.itemProcessor(new compute.Pass(stack, "Pass State 2"));

      return map;
    });

    expect(() => Testing.synth(spec, true)).toThrow(
      /Map state cannot have both an iterator and an item processor/,
    );
  });

  test("fails in synthesis if parameters and item selector are defined", () => {
    const spec = createStackWithMap((stack) => {
      const map = new compute.Map(stack, "Map State", {
        maxConcurrency: 1,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
        parameters: {
          foo: "foo",
          bar: compute.JsonPath.stringAt("$.bar"),
        },
        itemSelector: {
          foo: "foo",
          bar: compute.JsonPath.stringAt("$.bar"),
        },
      });

      return map;
    });

    expect(() => Testing.synth(spec, true)).toThrow(
      /Map state cannot have both parameters and an item selector/,
    );
  });

  test("fails in synthesis if distributed mode and execution type is not defined", () => {
    const spec = createStackWithMap((stack) => {
      const map = new compute.Map(stack, "Map State", {
        maxConcurrency: 1,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
      });
      map.itemProcessor(new compute.Pass(stack, "Pass State"), {
        mode: compute.ProcessorMode.DISTRIBUTED,
      });

      return map;
    });

    expect(() => Testing.synth(spec, true)).toThrow(
      /You must specify an execution type for the distributed Map workflow/,
    );
  });

  test("fails in synthesis when maxConcurrency is a float", () => {
    const spec = createStackWithMap((stack) => {
      const map = new compute.Map(stack, "Map State", {
        maxConcurrency: 1.2,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
      });
      map.iterator(new compute.Pass(stack, "Pass State"));

      return map;
    });

    expect(() => Testing.synth(spec, true)).toThrow(
      /maxConcurrency has to be a positive integer/,
    );
  });

  test("fails in synthesis when maxConcurrency is a negative integer", () => {
    const spec = createStackWithMap((stack) => {
      const map = new compute.Map(stack, "Map State", {
        maxConcurrency: -1,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
      });
      map.iterator(new compute.Pass(stack, "Pass State"));

      return map;
    });

    expect(() => Testing.synth(spec, true)).toThrow(
      /maxConcurrency has to be a positive integer/,
    );
  });

  test("fails in synthesis when maxConcurrency is too big to be an integer", () => {
    const spec = createStackWithMap((stack) => {
      const map = new compute.Map(stack, "Map State", {
        maxConcurrency: Number.MAX_VALUE,
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
      });
      map.iterator(new compute.Pass(stack, "Pass State"));

      return map;
    });

    expect(() => Testing.synth(spec, true)).toThrow(
      /maxConcurrency has to be a positive integer/,
    );
  });

  test("fails in synthesis when maxConcurrency and maxConcurrencyPath are both defined", () => {
    const spec = createStackWithMap((stack) => {
      const map = new compute.Map(stack, "Map State", {
        maxConcurrency: 1,
        maxConcurrencyPath: compute.JsonPath.stringAt("$.maxConcurrencyPath"),
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
      });
      map.iterator(new compute.Pass(stack, "Pass State"));

      return map;
    });

    expect(() => Testing.synth(spec, true)).toThrow(
      /Provide either `maxConcurrency` or `maxConcurrencyPath`, but not both/,
    );
  });

  test("does not fail synthesis when maxConcurrency is a jsonPath", () => {
    const spec = createStackWithMap((stack) => {
      const map = new compute.Map(stack, "Map State", {
        maxConcurrency: compute.JsonPath.numberAt("$.maxConcurrency"),
        itemsPath: compute.JsonPath.stringAt("$.inputForMap"),
      });
      map.iterator(new compute.Pass(stack, "Pass State"));

      return map;
    });

    expect(() => Testing.synth(spec, true)).not.toThrow();
  });

  test("isPositiveInteger is false with negative number", () => {
    expect(compute.isPositiveInteger(-1)).toEqual(false);
  });

  test("isPositiveInteger is false with decimal number", () => {
    expect(compute.isPositiveInteger(1.2)).toEqual(false);
  });

  test("isPositiveInteger is false with a value greater than safe integer", () => {
    const valueToTest = Number.MAX_SAFE_INTEGER + 1;
    expect(compute.isPositiveInteger(valueToTest)).toEqual(false);
  });

  test("isPositiveInteger is true with 0", () => {
    expect(compute.isPositiveInteger(0)).toEqual(true);
  });

  test("isPositiveInteger is true with 10", () => {
    expect(compute.isPositiveInteger(10)).toEqual(true);
  });

  test("isPositiveInteger is true with max integer value", () => {
    expect(compute.isPositiveInteger(Number.MAX_SAFE_INTEGER)).toEqual(true);
  });
});

// function render(sm: compute.IChainable) {
//   return new cdk.Stack().resolve(
//     new compute.StateGraph(sm.startState, "Test Graph").toGraphJson(),
//   );
// }

function createStackWithMap(mapFactory: (spec: AwsSpec) => compute.Map) {
  const app = Testing.app();
  const spec = new AwsSpec(app, `TestSpec`, {
    environmentName: "Test",
    gridUUID,
    providerConfig: {
      region: "us-east-1",
    },
    gridBackendConfig: {
      address: "http://localhost:3000",
    },
  });
  const map = mapFactory(spec);
  new compute.StateGraph(map, "Test Graph");
  return spec;
}
