import {
  Condition,
  Conditions,
  fromConditionJson,
  toConditionJson,
} from "../../../src/aws/iam/policy-statement";

describe("fromConditionJson", () => {
  it("should handle empty condition JSON", () => {
    const expected = new Array<Condition>();

    const result = fromConditionJson({});

    expect(result).toEqual(expected);
  });
  it("should convert a single test condition JSON to an array of statement conditions", () => {
    const conditionJson = {
      "ForAnyValue:StringEquals": {
        "kms:EncryptionContext:aws:pi:service": "rds",
      },
    };

    const expected: Conditions = [
      {
        test: "ForAnyValue:StringEquals",
        values: ["rds"],
        variable: "kms:EncryptionContext:aws:pi:service",
      },
    ];

    const result = fromConditionJson(conditionJson);

    expect(result).toEqual(expected);
  });
  it("should convert condition JSON to an array of statement conditions", () => {
    const conditionJson = {
      "ForAnyValue:StringEquals": {
        "kms:EncryptionContext:aws:pi:service": "rds",
        "kms:EncryptionContext:aws:rds:db-id": [
          "db-AAAAABBBBBCCCCCDDDDDEEEEE",
          "db-EEEEEDDDDDCCCCCBBBBBAAAAA",
        ],
        "kms:EncryptionContext:service": "pi",
      },
    };

    const expected: Conditions = [
      {
        test: "ForAnyValue:StringEquals",
        values: ["rds"],
        variable: "kms:EncryptionContext:aws:pi:service",
      },
      {
        test: "ForAnyValue:StringEquals",
        values: [
          "db-AAAAABBBBBCCCCCDDDDDEEEEE",
          "db-EEEEEDDDDDCCCCCBBBBBAAAAA",
        ],
        variable: "kms:EncryptionContext:aws:rds:db-id",
      },
      {
        test: "ForAnyValue:StringEquals",
        values: ["pi"],
        variable: "kms:EncryptionContext:service",
      },
    ];

    const result = fromConditionJson(conditionJson);

    expect(result).toEqual(expected);
  });
});

describe("toConditionJson", () => {
  it("should convert an array of statement conditions to condition JSON", () => {
    const conditions: Conditions = [
      {
        test: "ForAnyValue:StringEquals",
        values: ["rds"],
        variable: "kms:EncryptionContext:aws:pi:service",
      },
    ];

    const conditionJson = toConditionJson(...conditions);

    // Assertion
    expect(conditionJson).toEqual({
      "ForAnyValue:StringEquals": {
        "kms:EncryptionContext:aws:pi:service": "rds",
      },
    });
  });
});
