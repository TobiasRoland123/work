export type StatusProps = {
  message: string;
  absent?: boolean;
};

export function Status({ message, absent = false }: StatusProps) {
  const absentColor = absent ? 'bg-red-300' : 'bg-blue-300';
  return (
    <div className={` w-fit px-1.5 py-0.5 ${absentColor} rounded-md`}>
      <p className="text-sm">{message}</p>
    </div>
  );
}
