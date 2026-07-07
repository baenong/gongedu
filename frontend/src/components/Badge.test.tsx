import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Badge from "./Badge";

describe("Badge", () => {
  it("isDone이 true면 '이수완료'를 표시한다", () => {
    render(<Badge isDone />);
    expect(screen.getByText("이수완료")).toBeInTheDocument();
  });

  it("isDone이 false면 '미이수'를 표시한다", () => {
    render(<Badge isDone={false} />);
    expect(screen.getByText("미이수")).toBeInTheDocument();
  });
});
