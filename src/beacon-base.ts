import {
  Lazy,
  TerraformResource,
  TerraformElement,
  TerraformOutput,
  Aspects,
  IAspect,
} from "cdktf";
import { Construct, IConstruct } from "constructs";
import { SpecBase } from ".";

export interface BeaconProps {
  /**
   * The friendly name for beacon resources
   *
   * @default - `environmentName-id`
   */
  readonly friendlyName?: string;

  /**
   * Whether to register Terraform outputs for this beacon
   *
   * @default false
   */
  readonly registerOutputs?: boolean;

  /**
   * Optional override for the outputs name
   *
   * @default id
   */
  readonly outputName?: string;
}

export interface IBeacon {
  /**
   * Environment Name passed in from the CLI
   */
  readonly environmentName: string;
  readonly gridUUID: string;
  readonly outputs: Record<string, any>;
}

type TaggableConstruct = IConstruct & {
  tags?: { [key: string]: string };
  tagsInput?: { [key: string]: string };
};

function isTaggableConstruct(x: IConstruct): x is TaggableConstruct {
  return (
    TerraformResource.isTerraformResource(x) && "tags" in x && "tagsInput" in x
  );
}

const GRID_TAG_PREFIX = "et:grid";

// Add Grid Tags to all Beacon resources
export class GridTags implements IAspect {
  constructor(private tagsToAdd: Record<string, string>) {}
  visit(node: IConstruct) {
    if (isTaggableConstruct(node)) {
      // https://developer.hashicorp.com/terraform/cdktf/concepts/aspects
      const currentTags = node.tagsInput || {};
      node.tags = { ...this.tagsToAdd, ...currentTags };
    }
  }
}

/**
 * Base class for all Beacons
 *
 * Allows a Beacon to lazily register its outputs with its parent Spec
 */
export abstract class BeaconBase extends TerraformElement implements IBeacon {
  /**
   * The name under which the outputs are registered in the parent Scope
   */
  public readonly outputName: string;

  /**
   * Beacon friendly name
   */
  public readonly friendlyName: string;

  /**
   * Beacon unique grid identifier
   */
  public get gridUUID(): string {
    return SpecBase.ofBeacon(this).gridUUID;
  }

  /**
   * Environment Name passed in from the CLI
   */
  public get environmentName(): string {
    return SpecBase.ofBeacon(this).environmentName;
  }

  /**
   * Outputs to register with the parent Scope or undefined if there are no outputs
   */
  public abstract get outputs(): Record<string, any>;

  constructor(scope: Construct, id: string, props: BeaconProps) {
    super(scope, id);
    this.outputName = props.outputName || `${id}Outputs`;
    this.friendlyName = props.friendlyName || `${this.environmentName}-${id}`;

    Aspects.of(this) // Add Grid tags to every resource defined within.
      .add(
        new GridTags({
          [`${GRID_TAG_PREFIX}:EnvironmentName`]: this.environmentName,
          [`${GRID_TAG_PREFIX}:UUID`]: this.gridUUID,
          Name: this.friendlyName,
        }),
      );
    const registerOutputs = props.registerOutputs || false;
    if (registerOutputs) {
      new TerraformOutput(scope, this.outputName, {
        staticId: true,
        description: `Outputs for ${this.friendlyName}`,
        value: Lazy.anyValue({ produce: () => this.outputs || null }),
      });
    }
  }
}
