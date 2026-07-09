import { cn } from "@/lib/utils";

type ShrimpLogoProps = {
  className?: string;
};

export const ShrimpLogo = ({ className }: ShrimpLogoProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("shrink-0", className)}
    aria-hidden="true"
  >
    <path
      d="M3.5 14.2c1.8-5.2 7.4-9.1 14.8-7.2-.8 2.8-2.6 4.8-5.2 6-2.4 1.1-4.3 2.2-6.1 4.1-1.1 1.1-2.2 2.4-3.5 1.1Z"
      fill="currentColor"
    />
    <path
      d="M3.5 14.2c-2 1.1-3.1 3.1-2.2 5.3.9-1.1 1.9-2.2 2.9-3.3 1-1.4 1.4-2.8-.7-2Z"
      fill="currentColor"
      opacity="0.85"
    />
    <path
      d="M17.8 6.4c1.1-1.8 2.8-2.8 4.7-2.1M15.8 8.3c.2-1.9 1.8-3.5 3.7-3.8"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <path
      d="M9.8 16.1 7.6 19M11.8 16.8l-.8 4.1M13.8 16.1l.3 4.4"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <circle cx="16.6" cy="9.1" r="1" fill="white" />
  </svg>
);
