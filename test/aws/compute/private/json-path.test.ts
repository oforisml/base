import { JsonPath } from "../../../../src/aws/compute/";
import { renderInExpression } from "../../../../src/aws/compute//private/json-path";

describe("RenderInExpression", () => {
  test("simple number", () => {
    expect(renderInExpression(1)).toBe("1");
  });
  test("simple string", () => {
    expect(renderInExpression("a")).toBe("'a'");
  });
  test("string with backslash", () => {
    expect(renderInExpression("a\\b")).toBe("'a\\\\b'");
  });
  test("string with single quote", () => {
    expect(renderInExpression("a'b")).toBe("'a\\'b'");
  });
  test("string with curly braces", () => {
    expect(renderInExpression("\\{a\\}\\")).toBe("'\\{a\\}\\\\'");
  });
  test("jsonpath stringAt", () => {
    expect(renderInExpression(JsonPath.stringAt("$.Field"))).toBe("$.Field");
  });
  test("jsonpath numberAt", () => {
    expect(renderInExpression(JsonPath.numberAt("$.Field"))).toBe("$.Field");
  });
  test("jsonpath listAt", () => {
    expect(renderInExpression(JsonPath.listAt("$.Field"))).toBe("$.Field");
  });
  test("jsonpath objectAt", () => {
    expect(renderInExpression(JsonPath.objectAt("$.Field"))).toBe("$.Field");
  });
  test("raw array", () => {
    expect(() => renderInExpression([1, 2])).toThrow();
  });
});
