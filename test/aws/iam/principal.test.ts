import {
  dataAwsIamPolicyDocument,
  iamRole,
  dataAwsServicePrincipal,
} from "@cdktf/provider-aws";
import { Testing } from "cdktf";
import "cdktf/lib/testing/adapters/jest";
import { OpenIdConnectProvider } from "../../../src/aws/iam/oidc-provider";
import { PolicyDocument } from "../../../src/aws/iam/policy-document";
import { PolicyStatement } from "../../../src/aws/iam/policy-statement";
import {
  PrincipalProps,
  fromPrincipalJson,
  PrincipalType,
  ServicePrincipal,
  FederatedPrincipal,
  WebIdentityPrincipal,
  OpenIdConnectPrincipal,
  StarPrincipal,
  PrincipalWithConditions,
  AccountPrincipal,
} from "../../../src/aws/iam/principals";
import { Role } from "../../../src/aws/iam/role";
import { AwsSpec } from "../../../src/aws/spec";

const environmentName = "Test";
const gridUUID = "123e4567-e89b-12d3";
const providerConfig = { region: "us-east-1" };
const gridBackendConfig = {
  address: "http://localhost:3000",
};
test("cannot have multiple principals with different conditions in the same statement", () => {
  const spec = getAwsSpec();
  const role = new Role(spec, "Role", {
    assumedBy: new ServicePrincipal("sns"),
  });

  expect(() => {
    role.addToPolicy(
      new PolicyStatement({
        principals: [
          new ServicePrincipal("myService.amazon.com", {
            conditions: [
              {
                test: "StringEquals",
                variable: "hairColor",
                values: ["blond"],
              },
            ],
          }),
          new ServicePrincipal("yourservice.amazon.com", {
            conditions: [
              {
                test: "StringEquals",
                variable: "hairColor",
                values: ["black"],
              },
            ],
          }),
        ],
      }),
    );
  }).toThrow(
    /All principals in a PolicyStatement must have the same Conditions/,
  );
});

test("can have multiple principals with the same conditions in the same statement", () => {
  const spec = getAwsSpec();
  const role = new Role(spec, "Role", {
    assumedBy: new ServicePrincipal("sns"),
  });

  role.addToPolicy(
    new PolicyStatement({
      principals: [
        new ServicePrincipal("myService.amazon.com"),
        new ServicePrincipal("yourservice.amazon.com"),
      ],
    }),
  );

  role.addToPolicy(
    new PolicyStatement({
      principals: [
        new ServicePrincipal("myService.amazon.com", {
          conditions: [
            {
              test: "StringEquals",
              variable: "hairColor",
              values: ["blond"],
            },
          ],
        }),
        new ServicePrincipal("yourservice.amazon.com", {
          conditions: [
            {
              test: "StringEquals",
              variable: "hairColor",
              values: ["blond"],
            },
          ],
        }),
      ],
    }),
  );
});

test("use federated principal", () => {
  // GIVEN
  const spec = getAwsSpec();

  // WHEN
  const principal = new FederatedPrincipal("federated");

  // THEN
  expect(spec.resolve(principal.federated)).toStrictEqual("federated");
  expect(spec.resolve(principal.assumeRoleAction)).toStrictEqual(
    "sts:AssumeRole",
  );
  expect(spec.resolve(principal.conditions)).toStrictEqual([]);
});

test("use Web Identity principal", () => {
  // GIVEN
  const spec = getAwsSpec();

  // WHEN
  const principal = new WebIdentityPrincipal("cognito-identity.amazonaws.com");

  // THEN
  expect(spec.resolve(principal.federated)).toStrictEqual(
    "cognito-identity.amazonaws.com",
  );
  expect(spec.resolve(principal.assumeRoleAction)).toStrictEqual(
    "sts:AssumeRoleWithWebIdentity",
  );
});

test("use OpenID Connect principal from provider", () => {
  // GIVEN
  const spec = getAwsSpec();
  const provider = new OpenIdConnectProvider(spec, "MyProvider", {
    url: "https://openid-endpoint",
    clientIds: ["266362248691-342342xasdasdasda-apps.googleusercontent.com"],
  });

  // WHEN
  const principal = new OpenIdConnectPrincipal(provider);

  // THEN
  expect(spec.resolve(principal.federated)).toStrictEqual(
    "${aws_iam_openid_connect_provider.MyProvider_730BA1C8.arn}",
  );
});

test("StarPrincipal", () => {
  // GIVEN
  const spec = getAwsSpec();

  // WHEN
  const pol = new PolicyDocument(spec, "doc", {
    statement: [
      new PolicyStatement({
        actions: ["service:action"],
        resources: ["*"],
        principals: [new StarPrincipal()],
      }),
    ],
  });

  // THEN
  expect(pol.toDocumentJson()).toEqual({
    Statement: [
      {
        Action: "service:action",
        Effect: "Allow",
        Principal: "*",
        Resource: "*",
      },
    ],
    Version: "2012-10-17",
  });
});

test("PrincipalWithConditions.addCondition should work", () => {
  // GIVEN
  const spec = getAwsSpec();
  const basePrincipal = new ServicePrincipal("service.amazonaws.com");
  const principalWithConditions = new PrincipalWithConditions(basePrincipal, [
    {
      test: "StringEquals",
      variable: "aws:PrincipalOrgID",
      values: ["o-xxxxxxxxxxx"],
    },
  ]);

  // WHEN
  principalWithConditions.addConditionObject("StringEquals", {
    "aws:PrincipalTag/critical": "true",
  });
  new Role(spec, "Role", {
    assumedBy: principalWithConditions,
  });
  // Do prepare run to resolve all Terraform resources
  spec.prepareStack();
  const synthesized = Testing.synth(spec);
  // expect(synthesized).toMatchSnapshot();
  // THEN
  expect(synthesized).toHaveDataSource(
    dataAwsServicePrincipal.DataAwsServicePrincipal,
  ); // NOTE: without prepareStack, the dataAwsServicePrincipal is missing
  expect(synthesized).toHaveDataSourceWithProperties(
    dataAwsIamPolicyDocument.DataAwsIamPolicyDocument,
    {
      statement: [
        {
          actions: ["sts:AssumeRole"],
          condition: [
            {
              test: "StringEquals",
              values: ["o-xxxxxxxxxxx"],
              variable: "aws:PrincipalOrgID",
            },
            {
              test: "StringEquals",
              values: ["true"],
              variable: "aws:PrincipalTag/critical",
            },
          ],
          effect: "Allow",
          principals: [
            {
              identifiers: [
                "${data.aws_service_principal.aws_svcp_default_region_service.name}",
              ],
              type: "Service",
            },
          ],
        },
      ],
    },
  );
  expect(synthesized).toHaveResourceWithProperties(iamRole.IamRole, {
    assume_role_policy: expect.stringContaining(
      "data.aws_iam_policy_document.Role_AssumeRolePolicy",
    ),
  });
});

test("PrincipalWithConditions.addCondition with a new condition operator should work", () => {
  // GIVEN
  const spec = getAwsSpec();
  const basePrincipal = new ServicePrincipal("service.amazonaws.com");
  const principalWithConditions = new PrincipalWithConditions(
    basePrincipal,
    [],
  );

  // WHEN
  principalWithConditions.addConditionObject("StringEquals", {
    "aws:PrincipalTag/critical": "true",
  });
  principalWithConditions.addConditionObject("IpAddress", {
    "aws:SourceIp": "0.0.0.0/0",
  });

  new Role(spec, "Role", {
    assumedBy: principalWithConditions,
  });

  // THEN
  // Do prepare run to resolve all Terraform resources
  spec.prepareStack();
  const synthesized = Testing.synth(spec);
  expect(synthesized).toHaveDataSourceWithProperties(
    dataAwsIamPolicyDocument.DataAwsIamPolicyDocument,
    {
      statement: [
        {
          actions: ["sts:AssumeRole"],
          condition: [
            {
              test: "StringEquals",
              values: ["true"],
              variable: "aws:PrincipalTag/critical",
            },
            {
              test: "IpAddress",
              values: ["0.0.0.0/0"],
              variable: "aws:SourceIp",
            },
          ],
          effect: "Allow",
          principals: [
            {
              identifiers: [
                "${data.aws_service_principal.aws_svcp_default_region_service.name}",
              ],
              type: "Service",
            },
          ],
        },
      ],
    },
  );
  expect(synthesized).toHaveResourceWithProperties(iamRole.IamRole, {
    assume_role_policy: expect.stringContaining(
      "data.aws_iam_policy_document.Role_AssumeRolePolicy",
    ),
  });
});

test("PrincipalWithConditions inherits principalAccount from AccountPrincipal ", () => {
  // GIVEN
  const accountPrincipal = new AccountPrincipal("123456789012");
  const principalWithConditions = accountPrincipal.withConditions({
    test: "StringEquals",
    variable: "hairColor",
    values: ["blond"],
  });

  // THEN
  expect(accountPrincipal.principalAccount).toStrictEqual("123456789012");
  expect(principalWithConditions.principalAccount).toStrictEqual(
    "123456789012",
  );
});

test("AccountPrincipal can specify an organization", () => {
  // GIVEN
  const spec = getAwsSpec();

  // WHEN
  const pol = new PolicyDocument(spec, "doc", {
    statement: [
      new PolicyStatement({
        actions: ["service:action"],
        resources: ["*"],
        principals: [
          new AccountPrincipal("123456789012").inOrganization("o-xxxxxxxxxx"),
        ],
      }),
    ],
  });

  // THEN
  const synthesized = Testing.synth(spec);
  // expect(synthesized).toMatchSnapshot();
  expect(synthesized).toHaveDataSourceWithProperties(
    dataAwsIamPolicyDocument.DataAwsIamPolicyDocument,
    {
      statement: [
        expect.objectContaining({
          actions: ["service:action"],
          condition: [
            {
              test: "StringEquals",
              values: ["o-xxxxxxxxxx"],
              variable: "aws:PrincipalOrgID",
            },
          ],
          effect: "Allow",
          principals: [
            {
              identifiers: [
                "arn:${data.aws_partition.Partitition.partition}:iam::123456789012:root",
              ],
              type: "AWS",
            },
          ],
          resources: ["*"],
        }),
      ],
    },
  );
  // get resolved Policy Document JSON
  expect(spec.resolve(pol.toDocumentJson())).toEqual({
    Statement: [
      {
        Action: "service:action",
        Effect: "Allow",
        Principal: {
          AWS: "arn:${data.aws_partition.Partitition.partition}:iam::123456789012:root",
        },
        Condition: {
          StringEquals: {
            "aws:PrincipalOrgID": "o-xxxxxxxxxx",
          },
        },
        Resource: "*",
      },
    ],
    Version: "2012-10-17",
  });
});

test("Can enable session tags", () => {
  // GIVEN
  const spec = getAwsSpec();

  // WHEN
  new Role(spec, "Role", {
    assumedBy: new WebIdentityPrincipal("cognito-identity.amazonaws.com", [
      {
        test: "StringEquals",
        variable: "cognito-identity.amazonaws.com:aud",
        values: ["asdf"],
      },
      {
        test: "ForAnyValue:StringLike",
        variable: "cognito-identity.amazonaws.com:amr",
        values: ["authenticated"],
      },
    ]).withSessionTags(),
  });

  // THEN
  const synthesized = Testing.synth(spec);
  expect(synthesized).toHaveDataSourceWithProperties(
    dataAwsIamPolicyDocument.DataAwsIamPolicyDocument,
    {
      statement: [
        {
          actions: ["sts:AssumeRoleWithWebIdentity", "sts:TagSession"],
          condition: [
            {
              test: "StringEquals",
              variable: "cognito-identity.amazonaws.com:aud",
              values: ["asdf"],
            },
            {
              test: "ForAnyValue:StringLike",
              variable: "cognito-identity.amazonaws.com:amr",
              values: ["authenticated"],
            },
          ],
          effect: "Allow",
          principals: [
            {
              identifiers: ["cognito-identity.amazonaws.com"],
              type: "Federated",
            },
          ],
        },
      ],
    },
  );
});

test("Can enable session tags with conditions (order of calls is irrelevant)", () => {
  // GIVEN
  const spec = getAwsSpec();

  // WHEN
  new Role(spec, "Role", {
    assumedBy: new ServicePrincipal("s3")
      .withConditions({
        test: "StringEquals",
        variable: "hairColor",
        values: ["blond"],
      })
      .withSessionTags(),
  });

  new Role(spec, "Role2", {
    assumedBy: new ServicePrincipal("s3").withSessionTags().withConditions({
      test: "StringEquals",
      variable: "hairColor",
      values: ["blond"],
    }),
  });

  // THEN
  spec.prepareStack();
  const synthesized = Testing.synth(spec);
  // expect(synthesized).toMatchSnapshot();
  const assumeRolePolicies = Object.values(
    JSON.parse(synthesized).data.aws_iam_policy_document,
  );
  expect(assumeRolePolicies.length).toStrictEqual(2);
  expect(assumeRolePolicies[0]).toEqual(assumeRolePolicies[1]);
  // expect(synthesized).toHaveDataSourceWithProperties(
  //   dataAwsIamPolicyDocument.DataAwsIamPolicyDocument,
  //   {
  //     statement: [
  //       {
  //         actions: ["sts:AssumeRole", "sts:TagSession"],
  //         condition: [
  //           {
  //             test: "StringEquals",
  //             variable: "hairColor",
  //             values: ["blond"],
  //           },
  //         ],
  //         effect: "Allow",
  //         principals: [
  //           {
  //             identifiers: [
  //               "${data.aws_service_principal.aws_svcp_default_region_s3.id}",
  //             ],
  //             type: "Service",
  //           },
  //         ],
  //       },
  //     ],
  //   },
  // );
});

describe("fromPrincipalJson", () => {
  it("should handle empty condition JSON", () => {
    const expected = new Array<PrincipalProps>();

    const result = fromPrincipalJson({});

    expect(result).toEqual(expected);
  });
  it("should convert from AWS account Principal JSON", () => {
    const principalJson = {
      AWS: ["123456789012", "555555555555"],
    };

    const expected: PrincipalProps[] = [
      {
        type: PrincipalType.AWS,
        identifiers: ["123456789012", "555555555555"],
      },
    ];

    const result = fromPrincipalJson(principalJson);

    expect(result).toEqual(expected);
  });
  it("should convert from account with cannonical user AWS Principal JSON", () => {
    const principalJson = {
      AWS: ["arn:aws:iam::123456789012:root", "999999999999"],
      CanonicalUser:
        "79a59df900b949e55d96a1e698fbacedfd6e09d98eacf8f8d5218e7cd47ef2be",
    };

    const expected: PrincipalProps[] = [
      {
        type: PrincipalType.AWS,
        identifiers: ["arn:aws:iam::123456789012:root", "999999999999"],
      },
      {
        type: PrincipalType.CANONICALUSER,
        identifiers: [
          "79a59df900b949e55d96a1e698fbacedfd6e09d98eacf8f8d5218e7cd47ef2be",
        ],
      },
    ];

    const result = fromPrincipalJson(principalJson);

    expect(result).toEqual(expected);
  });
  it("should convert OIDC session principals JSON", () => {
    const principalJson = { Federated: "cognito-identity.amazonaws.com" };

    const expected: PrincipalProps[] = [
      {
        type: PrincipalType.FEDERATED,
        identifiers: ["cognito-identity.amazonaws.com"],
      },
    ];

    const result = fromPrincipalJson(principalJson);

    expect(result).toEqual(expected);
  });
  it("should convert AWS service principals JSON", () => {
    const principalJson = {
      Service: ["ecs.amazonaws.com", "elasticloadbalancing.amazonaws.com"],
    };

    const expected: PrincipalProps[] = [
      {
        type: PrincipalType.SERVICE,
        identifiers: [
          "ecs.amazonaws.com",
          "elasticloadbalancing.amazonaws.com",
        ],
      },
    ];

    const result = fromPrincipalJson(principalJson);

    expect(result).toEqual(expected);
  });
});

function getAwsSpec(): AwsSpec {
  const app = Testing.app();
  return new AwsSpec(app, "TestSpec", {
    environmentName,
    gridUUID,
    providerConfig,
    gridBackendConfig,
  });
}
