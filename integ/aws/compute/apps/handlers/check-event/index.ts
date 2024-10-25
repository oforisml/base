export const handler = async (event: any) => {
  if (event.status === "OK") return "success";
  throw new Error("failure");
};
