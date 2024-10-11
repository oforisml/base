import { iamSamlProvider } from "@cdktf/provider-aws";
import { Testing } from "cdktf";
import "cdktf/lib/testing/adapters/jest";
import {
  SamlMetadataDocument,
  SamlProvider,
} from "../../../src/aws/iam/saml-provider";
import { AwsSpec } from "../../../src/aws/spec";

const environmentName = "Test";
const gridUUID = "123e4567-e89b-12d3";
const providerConfig = { region: "us-east-1" };
const gridBackendConfig = {
  address: "http://localhost:3000",
};
let spec: AwsSpec;
beforeEach(() => {
  const app = Testing.app();
  spec = new AwsSpec(app, "TestSpec", {
    environmentName,
    gridUUID,
    providerConfig,
    gridBackendConfig,
  });
});

test("SAML provider", () => {
  new SamlProvider(spec, "Provider", {
    metadataDocument: SamlMetadataDocument.fromXml("document"),
  });

  expect(Testing.synth(spec)).toHaveResourceWithProperties(
    iamSamlProvider.IamSamlProvider,
    {
      saml_metadata_document: "document",
    },
  );
});

test("SAML provider name", () => {
  new SamlProvider(spec, "Provider", {
    metadataDocument: SamlMetadataDocument.fromXml("document"),
    name: "provider-name",
  });

  // const synthesized = Testing.synth(spec);
  // expect(synthesized).toMatchSnapshot();
  expect(Testing.synth(spec)).toHaveResourceWithProperties(
    iamSamlProvider.IamSamlProvider,
    {
      name: "provider-name",
      saml_metadata_document: "document",
    },
  );
});

test("throws with invalid name", () => {
  expect(
    () =>
      new SamlProvider(spec, "Provider", {
        name: "invalid name",
        metadataDocument: SamlMetadataDocument.fromXml("document"),
      }),
  ).toThrow(/Invalid SAML provider name/);
});
