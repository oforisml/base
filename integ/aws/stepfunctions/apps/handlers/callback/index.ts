import { SFNClient, SendTaskSuccessCommand } from "@aws-sdk/client-sfn";

export const handler = async function (event: any, context: any) {
  console.log("Event: ", event);
  const taskToken = event.token;
  const sfnClient = new SFNClient({});
  const response = await sfnClient.send(
    new SendTaskSuccessCommand({
      taskToken,
      output: JSON.stringify({ status: "SUCCEEDED" }),
    }),
  );
  console.log(response);
  return response;
};
