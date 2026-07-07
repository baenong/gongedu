import { afterEach, describe, expect, it } from "vitest";
// app.js를 import하면 initDatabase()가 실행되어 settings 테이블 등이 준비된다.
// isAiConfigured()가 내부적으로 DB 설정(settings)을 조회하므로 이 초기화가 필요하다.
import "../../app.js";
import { isAiConfigured } from "./verifyCertificate.js";

describe("isAiConfigured", () => {
  const keys = ["AI_PROVIDER", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"];
  const originalValues = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const key of keys) {
      if (originalValues[key] === undefined) delete process.env[key];
      else process.env[key] = originalValues[key];
    }
  });

  it("provider가 openai이고 OPENAI_API_KEY가 없으면 false를 반환한다", () => {
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;

    expect(isAiConfigured()).toBe(false);
  });

  it("provider가 openai이고 OPENAI_API_KEY가 있으면 true를 반환한다", () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";

    expect(isAiConfigured()).toBe(true);
  });

  it("provider가 claude이면 ANTHROPIC_API_KEY 존재 여부로 판단한다", () => {
    process.env.AI_PROVIDER = "claude";
    delete process.env.ANTHROPIC_API_KEY;
    expect(isAiConfigured()).toBe(false);

    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(isAiConfigured()).toBe(true);
  });

  it("알 수 없는 provider면 false를 반환한다", () => {
    process.env.AI_PROVIDER = "unknown";

    expect(isAiConfigured()).toBe(false);
  });
});
