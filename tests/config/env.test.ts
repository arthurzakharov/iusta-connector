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
        GIT_REPOSITORY_NAME: "acme/repo",
        GIT_REPOSITORY_TOKEN: "secret",
      }),
    ).toEqual({
      NODE_ENV: "production",
      PORT: 8080,
      LOG_LEVEL: "warn",
      ALLOWED_ORIGINS: ["https://app.example.com", "http://localhost:5173"],
      GIT_REPOSITORY_NAME: "acme/repo",
      GIT_REPOSITORY_TOKEN: "secret",
    });
  });

  test("requires deployment variables in production", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow(
      /ALLOWED_ORIGINS[\s\S]*GIT_REPOSITORY_NAME[\s\S]*GIT_REPOSITORY_TOKEN/,
    );
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        ALLOWED_ORIGINS: "https://app.example.com",
        GIT_REPOSITORY_NAME: "",
        GIT_REPOSITORY_TOKEN: "secret",
      }),
    ).toThrow(/required in production[\s\S]*GIT_REPOSITORY_NAME/);
  });

  test("does not require deployment variables outside production", () => {
    expect(() => parseEnv({ NODE_ENV: "development" })).not.toThrow();
    expect(() => parseEnv({ NODE_ENV: "test" })).not.toThrow();
  });

  test("normalises origins to what browsers send (no trailing slash or path)", () => {
    expect(
      parseEnv({
        ALLOWED_ORIGINS:
          "http://localhost:5173/,https://app.example.com/some/path",
      }).ALLOWED_ORIGINS,
    ).toEqual(["http://localhost:5173", "https://app.example.com"]);
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
