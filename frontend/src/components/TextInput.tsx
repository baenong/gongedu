import { twMerge } from "tailwind-merge";

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  type?: string;
  className?: string;
  isRequired?: boolean;
}

const TextInput = ({
  type = "text",
  className = "",
  isRequired = true,
  ...props
}: TextInputProps) => {
  const baseStyle =
    "mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

  return (
    <input
      type={type}
      required={isRequired}
      {...props}
      className={twMerge(baseStyle, className)}
    />
  );
};

export default TextInput;
