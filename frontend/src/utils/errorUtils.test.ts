import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { getErrorMessage } from "./errorUtils";

function makeAxiosError(message?: string) {
  return new AxiosError(
    "Request failed",
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    {
      status: 400,
      statusText: "Bad Request",
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: message === undefined ? {} : { message },
    },
  );
}

describe("getErrorMessage", () => {
  it("axios 에러이고 응답에 message가 있으면 그 메시지를 반환한다", () => {
    const error = makeAxiosError("서버에서 보낸 에러 메시지");
    expect(getErrorMessage(error, "기본 메시지")).toBe("서버에서 보낸 에러 메시지");
  });

  it("axios 에러이지만 응답에 message가 없으면 fallback을 반환한다", () => {
    const error = makeAxiosError(undefined);
    expect(getErrorMessage(error, "기본 메시지")).toBe("기본 메시지");
  });

  it("axios 에러가 아니면 fallback을 반환한다", () => {
    expect(getErrorMessage(new Error("일반 에러"), "기본 메시지")).toBe(
      "기본 메시지",
    );
    expect(getErrorMessage("문자열 에러", "기본 메시지")).toBe("기본 메시지");
    expect(getErrorMessage(null, "기본 메시지")).toBe("기본 메시지");
  });
});
