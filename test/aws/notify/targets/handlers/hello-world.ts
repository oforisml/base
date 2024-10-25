export const handler: any = async (_event, _context) => {
  try {
    const response = {
      statusCode: 200,
      body: JSON.stringify({ message: "Hello, world!" }),
    };
    return response;
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
