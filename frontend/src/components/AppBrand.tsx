import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ShrimpLogo } from "@/components/ShrimpLogo";

type AppBrandProps = {
  size?: "sm" | "md" | "lg";
  to?: string;
  className?: string;
};

const sizeConfig = {
  sm: { icon: "w-5 h-5", text: "text-base" },
  md: { icon: "w-6 h-6", text: "text-lg" },
  lg: { icon: "w-8 h-8", text: "text-2xl" },
};

export const AppBrand = ({ size = "md", to, className }: AppBrandProps) => {
  const config = sizeConfig[size];
  const content = (
    <>
      <ShrimpLogo className={cn(config.icon, "text-primary")} />
      <span className={cn(config.text, "font-bold text-foreground tracking-tight")}>Nhà Tôm</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cn("inline-flex items-center gap-2", className)}>
        {content}
      </Link>
    );
  }

  return <div className={cn("flex items-center gap-2", className)}>{content}</div>;
};
