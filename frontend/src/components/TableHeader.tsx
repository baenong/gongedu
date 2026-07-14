import { twMerge } from "tailwind-merge";

interface TableHeaderProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  className?: string;
}

const TableHeader = ({ children, className, ...props }: TableHeaderProps) => {
  const baseStyle =
    "px-4 py-3 text-center text-base font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider";

  return (
    <th {...props} className={twMerge(baseStyle, className)}>
      {children}
    </th>
  );
};

export default TableHeader;
