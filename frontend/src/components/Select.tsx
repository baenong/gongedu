import React from "react";
import type { SelectOption } from "../types";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[]; // 옵션 리스트
  className?: string;
}

const Select = ({ options, className = "", ...props }: SelectProps) => {
  return (
    <div className={className}>
      <div className="relative">
        <select
          {...props}
          className="appearance-none w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 pr-8 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 cursor-pointer disabled:bg-gray-100 disabled:text-gray-500"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* 화살표 아이콘 커스텀 */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
          <svg
            className="h-4 w-4 fill-current"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
          >
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default Select;
