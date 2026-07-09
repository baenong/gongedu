import type { Department, Team } from "../types";

interface GroupRowProps {
  group: Department | Team;
  selected: number;
  onClick: () => void;
}

const GroupRow = ({ group, selected, onClick }: GroupRowProps) => {
  return (
    <div
      key={`${group.name}-${group.id}`}
      className={`flex justify-between gap-1 rounded py-2 px-4 ${group.id === selected ? "bg-green-300 text-gray-700 font-medium" : ""}`}
      onClick={onClick}
    >
      <div>{group.name}</div>
      <div>{group.orderIndex}</div>
    </div>
  );
};

export default GroupRow;
