import { useEffect, useRef, useState } from "react";

interface ScrollFadeProps {
  className?: string;
  children: React.ReactNode;
}

const ScrollFade = ({ className = "", children }: ScrollFadeProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  const updateFade = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowFade(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);
    el.addEventListener("scroll", updateFade);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateFade);
    };
  }, []);

  // 컨텐츠 변경 시마다 재계산
  useEffect(() => {
    updateFade();
  });

  return (
    <div className="relative mt-5 border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
      <div ref={scrollRef} className={className}>
        {children}
      </div>
      <div
        className={`pointer-events-none absolute bottom-0 left-0 right-0 h-16
          flex flex-col justify-end
          bg-linear-to-t from-white dark:from-gray-800 to-transparent
          transition-opacity duration-300
          ${showFade ? "opacity-100" : "opacity-0"}`}
      >
        <div className="text-center text-gray-200 dark:text-gray-700">▼</div>
      </div>
    </div>
  );
};

export default ScrollFade;
