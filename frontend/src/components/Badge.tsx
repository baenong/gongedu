import { twMerge } from "tailwind-merge";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  isDone?: boolean;
  isUrgent?: boolean;
  className?: string;
}

const Badge = ({
  isDone = false,
  isUrgent = false,
  className = "",
  ...props
}: BadgeProps) => {
  const baseStyle = `px-2 py-1 text-sm font-semibold rounded-full whitespace-nowrap ${
    isDone
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      : isUrgent
        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        : "bg-orange-200 text-orange-800"
  }`;

  return (
    <span {...props} className={twMerge(baseStyle, className)}>
      {isDone ? "이수완료" : "미이수"}
    </span>
  );
};

export default Badge;
