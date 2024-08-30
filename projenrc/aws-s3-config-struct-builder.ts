import * as path from "path";
import { CollectionKind, PrimitiveType } from "@jsii/spec";
import { ProjenStruct, Struct } from "@mrgrain/jsii-struct-builder";
import { Component, typescript } from "projen";

const namespace = "staticsite";

/**
 * S3BucketWebsiteConfigurationConfig without bucket, redirectAllRequestsTo, expectedBucketOwner
 */
export class S3BucketWebsiteConfigurationConfigStructBuilder extends Component {
  constructor(project: typescript.TypeScriptProject) {
    super(project);
    const struct = new ProjenStruct(project, {
      name: "WebsiteConfig",
      description: [
        "Provides an S3 bucket website configuration resource.",
        " *",
        " * For more information, see [Hosting Websites on S3](https://docs.aws.amazon.com/AmazonS3/latest/dev/WebsiteHosting.html).",
      ].join("\n"),
      filePath: path.join(
        project.srcdir,
        "aws",
        namespace,
        "website-config.generated.ts",
      ),
    });

    struct
      .mixin(
        Struct.fromFqn(
          "@cdktf/provider-aws.s3BucketWebsiteConfiguration.S3BucketWebsiteConfigurationConfig",
        ),
      )
      .omit("bucket", "redirectAllRequestsTo", "expectedBucketOwner")
      .add({
        name: "enabled",
        docs: {
          summary: "Set this to true to enable static website hosting.",
          default: "`true`",
        },
        optional: false,
        type: {
          primitive: PrimitiveType.Boolean,
        },
      })
      .update("indexDocument", {
        type: {
          primitive: PrimitiveType.String, // wrap in `{ suffix: }`
        },
        docs: {
          default: "index.html",
        },
      });
  }
}

/**
 * S3BucketCorsConfigurationConfig without bucket but with strongly typed corsRule.allowedMethods
 */
export class S3BucketCorsConfigurationConfigStructBuilder extends Component {
  constructor(project: typescript.TypeScriptProject) {
    super(project);
    const corsRuleConfigStruct = new ProjenStruct(project, {
      name: "CorsRuleConfig",
      description:
        "Set of origins and methods (cross-origin access that you want to allow).",
      filePath: path.join(
        project.srcdir,
        "aws",
        namespace,
        "cors-rule-config.generated.ts",
      ),
      importLocations: {
        [namespace]: "./",
      },
    });

    corsRuleConfigStruct
      .mixin(
        Struct.fromFqn(
          "@cdktf/provider-aws.s3BucketCorsConfiguration.S3BucketCorsConfigurationCorsRule",
        ),
      )
      .update("allowedMethods", {
        docs: {
          summary: "Set of HTTP methods that you allow the origin to execute.",
        },
        type: {
          collection: {
            kind: CollectionKind.Array,
            elementtype: {
              // refer to enum instead of type unions with literals (JSII restriction)
              // ref: https://aws.github.io/jsii/specification/2-type-system/#type-unions
              fqn: `${namespace}.HttpMethods`,
            },
          },
        },
      });

    const corsConfigStruct = new ProjenStruct(project, {
      name: "CorsConfig",
      description: [
        "Provides an S3 bucket CORS configuration resource.",
        " *",
        " * For more information about CORS, go to",
        " * [Enabling Cross-Origin Resource Sharing](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html)",
        " * in the Amazon S3 User Guide.",
      ].join("\n"),
      filePath: path.join(
        project.srcdir,
        "aws",
        namespace,
        "cors-config.generated.ts",
      ),
      importLocations: {
        [namespace]: "./",
      },
    });

    corsConfigStruct
      .mixin(
        Struct.fromFqn(
          "@cdktf/provider-aws.s3BucketCorsConfiguration.S3BucketCorsConfigurationConfig",
        ),
      )
      .omit("bucket")
      .update("corsRule", {
        docs: {
          summary:
            "A set of origins and methods (cross-origin access that you want to allow).",
        },
        type: {
          union: {
            types: [
              { fqn: "cdktf.IResolvable" },
              {
                collection: {
                  kind: CollectionKind.Array,
                  elementtype: { fqn: `${namespace}.CorsRuleConfig` },
                },
              },
            ],
          },
        },
      });
  }
}
