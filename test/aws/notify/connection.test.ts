import { cloudwatchEventConnection } from "@cdktf/provider-aws";
import { Testing } from "cdktf";
import "cdktf/lib/testing/adapters/jest";
import * as notify from "../../../src/aws/notify";
import { AwsSpec } from "../../../src/aws/spec";
// import { SecretValue, Stack } from "../../core";

const environmentName = "Test";
const gridUUID = "123e4567-e89b-12d3";
const providerConfig = { region: "us-east-1" };
const gridBackendConfig = {
  address: "http://localhost:3000",
};

test("basic connection", () => {
  // GIVEN
  const spec = getAwsSpec();

  // WHEN
  new notify.Connection(spec, "Connection", {
    authorization: notify.Authorization.basic(
      "username",
      "password", // TODO: should be sensitive
    ),
    connectionName: "testConnection",
    description: "ConnectionDescription",
  });

  // THEN
  // Do prepare run to resolve all Terraform resources
  spec.prepareStack();
  const synthesized = Testing.synth(spec);
  // expect(synthesized).toMatchSnapshot();
  expect(synthesized).toHaveResourceWithProperties(
    cloudwatchEventConnection.CloudwatchEventConnection,
    {
      name: "testConnection",
      description: "ConnectionDescription",
      authorization_type: "BASIC",
      auth_parameters: {
        basic: {
          password: "password",
          username: "username",
        },
      },
    },
  );
  // const template = Template.fromStack(spec);
  // template.hasResourceProperties("AWS::Events::Connection", {
  //   AuthorizationType: "BASIC",
  //   AuthParameters: {
  //     BasicAuthParameters: {
  //       Password: "password",
  //       Username: "username",
  //     },
  //   },
  //   Name: "testConnection",
  //   Description: "ConnectionDescription",
  // });
});

test("API key connection", () => {
  // GIVEN
  const spec = getAwsSpec();

  // WHEN
  new notify.Connection(spec, "Connection", {
    authorization: notify.Authorization.apiKey(
      "keyname",
      "keyvalue", // TODO: should be sensitive
    ),
  });

  // THEN
  // Do prepare run to resolve all Terraform resources
  spec.prepareStack();
  const synthesized = Testing.synth(spec);
  // expect(synthesized).toMatchSnapshot();
  expect(synthesized).toHaveResourceWithProperties(
    cloudwatchEventConnection.CloudwatchEventConnection,
    {
      authorization_type: "API_KEY",
      auth_parameters: {
        api_key: {
          key: "keyname",
          value: "keyvalue",
        },
      },
    },
  );
  // const template = Template.fromStack(spec);
  // template.hasResourceProperties("AWS::Events::Connection", {
  //   AuthorizationType: "API_KEY",
  //   AuthParameters: {
  //     ApiKeyAuthParameters: {
  //       ApiKeyName: "keyname",
  //       ApiKeyValue: "keyvalue",
  //     },
  //   },
  // });
});

test("oauth connection", () => {
  // GIVEN
  const spec = getAwsSpec();

  // WHEN
  new notify.Connection(spec, "Connection", {
    authorization: notify.Authorization.oauth({
      authorizationEndpoint: "authorizationEndpoint",
      clientId: "clientID",
      clientSecret: "clientSecret", // TODO: should be sensitive
      httpMethod: notify.HttpMethod.GET,
      headerParameters: {
        oAuthHeaderKey: notify.HttpParameter.fromString("oAuthHeaderValue"),
      },
    }),
    headerParameters: {
      invocationHeaderKey: notify.HttpParameter.fromString(
        "invocationHeaderValue",
      ),
    },
    connectionName: "testConnection",
    description: "ConnectionDescription",
  });

  // THEN
  // Do prepare run to resolve all Terraform resources
  spec.prepareStack();
  const synthesized = Testing.synth(spec);
  // expect(synthesized).toMatchSnapshot();
  expect(synthesized).toHaveResourceWithProperties(
    cloudwatchEventConnection.CloudwatchEventConnection,
    {
      authorization_type: "OAUTH_CLIENT_CREDENTIALS",
      auth_parameters: {
        oauth: {
          authorization_endpoint: "authorizationEndpoint",
          client_parameters: {
            client_id: "clientID",
            client_secret: "clientSecret",
          },
          http_method: "GET",
          oauth_http_parameters: {
            header: [
              {
                is_value_secret: false,
                key: "oAuthHeaderKey",
                value: "oAuthHeaderValue",
              },
            ],
          },
        },
        invocation_http_parameters: {
          header: [
            {
              is_value_secret: false,
              key: "invocationHeaderKey",
              value: "invocationHeaderValue",
            },
          ],
        },
      },
      description: "ConnectionDescription",
      name: "testConnection",
    },
  );
  // const template = Template.fromStack(spec);
  // template.hasResourceProperties("AWS::Events::Connection", {
  //   AuthorizationType: "OAUTH_CLIENT_CREDENTIALS",
  //   AuthParameters: {
  //     OAuthParameters: {
  //       AuthorizationEndpoint: "authorizationEndpoint",
  //       ClientParameters: {
  //         ClientID: "clientID",
  //         ClientSecret: "clientSecret",
  //       },
  //       HttpMethod: "GET",
  //       OAuthHttpParameters: {
  //         HeaderParameters: [
  //           {
  //             Key: "oAuthHeaderKey",
  //             Value: "oAuthHeaderValue",
  //             IsValueSecret: false,
  //           },
  //         ],
  //       },
  //     },
  //     InvocationHttpParameters: {
  //       HeaderParameters: [
  //         {
  //           Key: "invocationHeaderKey",
  //           Value: "invocationHeaderValue",
  //         },
  //       ],
  //     },
  //   },
  //   Name: "testConnection",
  //   Description: "ConnectionDescription",
  // });
});

test("Additional plaintext headers", () => {
  // GIVEN
  const spec = getAwsSpec();

  // WHEN
  new notify.Connection(spec, "Connection", {
    authorization: notify.Authorization.apiKey(
      "keyname",
      "keyvalue", // TODO: should be sensitive
    ),
    headerParameters: {
      "content-type": notify.HttpParameter.fromString("application/json"),
    },
  });

  // THEN
  // Do prepare run to resolve all Terraform resources
  spec.prepareStack();
  const synthesized = Testing.synth(spec);
  // expect(synthesized).toMatchSnapshot();
  expect(synthesized).toHaveResourceWithProperties(
    cloudwatchEventConnection.CloudwatchEventConnection,
    {
      authorization_type: "API_KEY",
      auth_parameters: {
        api_key: {
          key: "keyname",
          value: "keyvalue",
        },
        invocation_http_parameters: {
          header: [
            {
              key: "content-type",
              value: "application/json",
              is_value_secret: false,
            },
          ],
        },
      },
    },
  );
  // const template = Template.fromStack(spec);
  // template.hasResourceProperties("AWS::Events::Connection", {
  //   AuthParameters: {
  //     InvocationHttpParameters: {
  //       HeaderParameters: [
  //         {
  //           Key: "content-type",
  //           Value: "application/json",
  //           IsValueSecret: false,
  //         },
  //       ],
  //     },
  //   },
  // });
});

test("Additional secret headers", () => {
  // GIVEN
  const spec = getAwsSpec();

  // WHEN
  new notify.Connection(spec, "Connection", {
    authorization: notify.Authorization.apiKey(
      "keyname",
      "keyvalue", // TODO: should be sensitive
    ),
    headerParameters: {
      "client-secret": notify.HttpParameter.fromSecret(
        "apiSecret", // TODO: should be sensitive
      ),
    },
  });

  // THEN
  // Do prepare run to resolve all Terraform resources
  spec.prepareStack();
  const synthesized = Testing.synth(spec);
  // expect(synthesized).toMatchSnapshot();
  expect(synthesized).toHaveResourceWithProperties(
    cloudwatchEventConnection.CloudwatchEventConnection,
    {
      authorization_type: "API_KEY",
      auth_parameters: {
        api_key: {
          key: "keyname",
          value: "keyvalue",
        },
        invocation_http_parameters: {
          header: [
            {
              key: "client-secret",
              value: "apiSecret",
              is_value_secret: true,
            },
          ],
        },
      },
    },
  );
  // const template = Template.fromStack(spec);
  // template.hasResourceProperties("AWS::Events::Connection", {
  //   AuthParameters: {
  //     InvocationHttpParameters: {
  //       HeaderParameters: [
  //         {
  //           Key: "client-secret",
  //           Value: "apiSecret",
  //           IsValueSecret: true,
  //         },
  //       ],
  //     },
  //   },
  // });
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
