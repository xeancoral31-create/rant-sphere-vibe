import { Network } from "lucide-react";

/** OutLoud brand mark. Keeps the circular gradient container from the original icon. */
export function Logo({
  className = "w-9 h-9",
  plain = false,
}: {
  className?: string;
  plain?: boolean;
}) {
  if (plain) {
    return <Network className={className} />;
  }
  return (
    <div
      className={`${className} rounded-full bg-red-100 grid place-items-center shadow-glow overflow-hidden shrink-0`}
    >
      <Network className="w-[68%] h-[68%] text-red-500" />
    </div>
  );
}
