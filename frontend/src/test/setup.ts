import "@testing-library/jest-dom/vitest";

// jsdom에는 ResizeObserver가 구현되어 있지 않아, 이를 사용하는 컴포넌트(ScrollFade,
// ScrollableTextarea 등)를 렌더링하는 테스트가 실패하지 않도록 최소 스텁을 제공한다.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
