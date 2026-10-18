import { SERVICES } from "lib/inbox/types";

const INITIALS = { slack: "S", chatwork: "C", line: "L", discord: "D", demo: "?" };

export const ServiceBadge = ({ service, size = "sm", withLabel = false }) => {
	const info = SERVICES[service] || SERVICES.demo;
	const dim = size === "lg" ? "h-9 w-9 text-sm" : "h-5 w-5 text-[10px]";
	return (
		<span className="inline-flex items-center gap-1.5">
			<span
				className={`${dim} inline-flex shrink-0 items-center justify-center rounded-md font-bold text-white`}
				style={{ backgroundColor: info.color }}
				title={info.label}
			>
				{INITIALS[service] || "?"}
			</span>
			{withLabel && <span className="text-xs text-gray-600">{info.label}</span>}
		</span>
	);
};
