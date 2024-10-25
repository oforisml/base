export const handler = async (event: any) => {
  console.log("Event: %j", event);
  if (event.status === "error") throw new Error("UnkownError");
  return event;
};
