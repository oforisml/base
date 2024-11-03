export const handler = async function (event: any, context: any) {
  const expectedFields = [
    "execId",
    "execInput",
    "execName",
    "execRoleArn",
    "execStartTime",
    "stateEnteredTime",
    "stateName",
    "stateRetryCount",
    "stateMachineId",
    "stateMachineName",
  ];
  const fieldsAreSet = expectedFields.every(
    (field) => event[field] !== undefined,
  );
  return {
    status: event.statusCode === "200" && fieldsAreSet ? "SUCCEEDED" : "FAILED",
  };
};
