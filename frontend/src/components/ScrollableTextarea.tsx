import { useEffect, useRef, useState } from "react";

type ScrollableTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const ScrollableTextarea = ({
  className = "",
  ...props
}: ScrollableTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showFade, setShowFade] = useState(false);

  const updateFade = () => {
    const el = textareaRef.current;
    if (!el) return;
    setShowFade(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);
    el.addEventListener("scroll", updateFade);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateFade);
    };
  }, []);

  // 입력으로 내용이 바뀔 때마다 재계산
  useEffect(() => {
    updateFade();
  });

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        {...props}
        className={`scrollbar-hide ${className}`}
      />
      <div
        className={`pointer-events-none absolute bottom-0.5 left-0.5 right-0.5 h-6 rounded-b
          bg-linear-to-t from-white dark:from-gray-700 to-transparent
          transition-opacity duration-300
          ${showFade ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
};

export default ScrollableTextarea;
