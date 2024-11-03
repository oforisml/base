export const handler = async function (event: any, context: any) {
  return {
    status: event.statusCode === "200" ? "SUCCEEDED" : "FAILED",
  };
};
