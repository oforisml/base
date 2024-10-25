import path from "path";
import * as constructs from "constructs";
import { compute } from "../../../../src/aws";

export class TestFunction extends compute.NodejsFunction {
  constructor(scope: constructs.Construct, id: string) {
    super(scope, id, {
      path: path.join(__dirname, "fixtures", "log-event.ts"),
    });
  }
}
