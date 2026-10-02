import { describe, expect, test } from "bun:test";
import { parseEnv } from "@/config/env";

describe("parseEnv", () => {
  test("applies defaults", () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: "development",
      PORT: 3000,
      LOG_LEVEL: "info",
      ALLOWED_ORIGINS: [],
    });
  });

  test("parses provided values", () => {
    expect(
      parseEnv({
        NODE_ENV: "production",
        PORT: "8080",
        LOG_LEVEL: "warn",
        ALLOWED_ORIGINS: " https://app.example.com, http://localhost:5173 ,",
      }),
    ).toEqual({
      NODE_ENV: "production",
      PORT: 8080,
      LOG_LEVEL: "warn",
      ALLOWED_ORIGINS: ["https://app.example.com", "http://localhost:5173"],
    });
  });

  test("throws a readable error for invalid values", () => {
    expect(() =>
      parseEnv({
        PORT: "abc",
        LOG_LEVEL: "loud",
        ALLOWED_ORIGINS: "not-a-url",
      }),
    ).toThrow(
      /Invalid environment variables[\s\S]*PORT[\s\S]*LOG_LEVEL[\s\S]*ALLOWED_ORIGINS/,
    );
  });
});
