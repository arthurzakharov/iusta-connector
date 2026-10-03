import type { RequestIdVariables } from "hono/request-id";
import type { Logger } from "@/types/logger";

export type AppEnv = {
  Variables: RequestIdVariables & {
    logger: Logger;
  };
};
