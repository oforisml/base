import {
  cloudfrontOriginAccessIdentity,
  dataAwsCloudfrontOriginAccessIdentity,
} from "@cdktf/provider-aws";
import { ITerraformDependable } from "cdktf";
import { Construct } from "constructs";
import { AwsBeaconBase, IAwsBeacon, AwsBeaconProps } from "..";

// TODO: migrate to OAC
// https://github.com/aws/aws-cdk/pull/31254
// https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html#migrate-from-oai-to-oac
// https://registry.terraform.io/providers/hashicorp/aws/5.60.0/docs/resources/cloudfront_origin_access_control

export interface OriginAccessIdentityProps extends AwsBeaconProps {
  /**
   * A comment to describe the origin access identity.
   */
  readonly comment?: string;
}

/**
 * Interface for CloudFront OriginAccessIdentity
 */
export interface IOriginAccessIdentity extends IAwsBeacon {
  /**
   * The Origin Access Identity Id (physical id)
   */
  readonly originAccessIdentityId: string;
  /**
   * A shortcut to the full path for the origin access identity to use in CloudFront.
   *
   * Example: `origin-access-identity/cloudfront/E2QWRUHAPOMQZL`.
   */
  readonly cloudFrontOriginAccessIdentityPath: string;
  /**
   * Pre-generated ARN for use in S3 bucket policies.
   *
   * Example: `arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity E2QWRUHAPOMQZL`.
   */
  readonly iamArn: string;
}

abstract class OriginAccessIdentityBase extends AwsBeaconBase {
  /**
   * Resource to depend on to make sure the OriginAccessIdentity is created before using it.
   */
  public abstract readonly resource: ITerraformDependable;

  /**
   * The Origin Access Identity Id (physical id)
   */
  public abstract readonly originAccessIdentityId: string;

  /**
   * A shortcut to the full path for the origin access identity to use in CloudFront.
   */
  public abstract readonly cloudFrontOriginAccessIdentityPath: string;

  /**
   * Pre-generated ARN for use in S3 bucket policies.
   */
  public abstract readonly iamArn: string;

  public get outputs(): Record<string, any> {
    return {
      originAccessIdentityId: this.originAccessIdentityId,
      iamArn: this.iamArn,
    };
  }
}

/**
 * An origin access identity is a special CloudFront user that you can
 * associate with Amazon S3 origins, so that you can secure all or just some of
 * your Amazon S3 content.
 */
export class OriginAccessIdentity
  extends OriginAccessIdentityBase
  implements IOriginAccessIdentity
{
  /**
   * Creates a OriginAccessIdentity by providing the OriginAccessIdentityId.
   */
  public static fromOriginAccessIdentityId(
    scope: Construct,
    id: string,
    originAccessIdentityId: string,
  ): IOriginAccessIdentity {
    class Import extends OriginAccessIdentityBase {
      public readonly resource: dataAwsCloudfrontOriginAccessIdentity.DataAwsCloudfrontOriginAccessIdentity;
      public readonly originAccessIdentityId = originAccessIdentityId;
      public readonly cloudFrontOriginAccessIdentityPath: string;
      public readonly iamArn: string;
      constructor(s: Construct, i: string) {
        super(s, i, {});
        this.resource =
          new dataAwsCloudfrontOriginAccessIdentity.DataAwsCloudfrontOriginAccessIdentity(
            this,
            "Resource",
            {
              id: originAccessIdentityId,
            },
          );
        this.cloudFrontOriginAccessIdentityPath =
          this.resource.cloudfrontAccessIdentityPath;
        this.iamArn = this.resource.iamArn;
      }
    }

    return new Import(scope, id);
  }

  /**
   * The Origin Access Identity Id (physical id)
   *
   * @attribute
   */
  public readonly originAccessIdentityId: string;

  /**
   * A shortcut to the full path for the origin access identity to use in CloudFront.
   *
   * @attribute
   */
  public readonly cloudFrontOriginAccessIdentityPath: string;

  /**
   * Pre-generated ARN for use in S3 bucket policies.
   *
   * @attribute
   */
  public readonly iamArn: string;

  /**
   * CDKTF L1 resource
   */
  public readonly resource: cloudfrontOriginAccessIdentity.CloudfrontOriginAccessIdentity;

  constructor(scope: Construct, id: string, props?: OriginAccessIdentityProps) {
    super(scope, id, props ?? {});

    // Comment has a max length of 128.
    const comment = (
      props?.comment ?? "Allows CloudFront to reach the bucket"
    ).slice(0, 128);
    this.resource =
      new cloudfrontOriginAccessIdentity.CloudfrontOriginAccessIdentity(
        this,
        "Resource",
        {
          comment,
        },
      );
    // physical id - OAI Id
    this.originAccessIdentityId = this.resource.id;
    this.cloudFrontOriginAccessIdentityPath =
      this.resource.cloudfrontAccessIdentityPath;
    this.iamArn = this.resource.iamArn;
  }
}
