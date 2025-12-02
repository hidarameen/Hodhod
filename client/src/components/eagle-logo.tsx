import { useTheme } from "next-themes";

export function EagleLogo({ 
  size = 40, 
  flip = false,
  className = "" 
}: { 
  size?: number
  flip?: boolean
  className?: string 
}) {
  const { theme } = useTheme();
  
  const logoSrc = theme === "dark" 
    ? "/attached_assets/generated_images/eagle-logo-dark.png"
    : "/attached_assets/generated_images/eagle-logo-futuristic.png";

  return (
    <img 
      src={logoSrc}
      alt="Eagle Logo"
      style={{ 
        width: `${size}px`, 
        height: `${size}px`,
        transform: flip ? 'scaleX(-1)' : 'scaleX(1)'
      }}
      className={className}
    />
  );
}
