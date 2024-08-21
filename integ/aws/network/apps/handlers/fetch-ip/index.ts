import https from "https";
import { Handler } from "aws-lambda";

interface FetchIpEvent {
  url: string;
}

interface FetchIpResponse {
  host: string;
  ip: string;
}

export const handler: Handler<FetchIpEvent, FetchIpResponse> = (
  event,
  _context,
  callback,
) => {
  https
    .get(event.url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        const result = JSON.parse(data) as FetchIpResponse;
        callback(null, result);
      });
    })
    .on("error", (e) => {
      callback(e);
    });
};
