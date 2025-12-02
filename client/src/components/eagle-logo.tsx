import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function EagleLogo({ 
  size = 40, 
  flip = false,
  className = "" 
}: { 
  size?: number
  flip?: boolean
  className?: string 
}) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use resolvedTheme to prevent hydration mismatch
  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark");
  
  const logoSrc = isDark 
    ? "/attached_assets/generated_images/eagle-logo-dark.png"
    : "/attached_assets/generated_images/eagle-logo-futuristic.png";

  return (
    <img 
      key={logoSrc}
      src={logoSrc}
      alt="Eagle Logo"
      style={{ 
        width: `${size}px`, 
        height: `${size}px`,
        transform: flip ? 'scaleX(-1)' : 'scaleX(1)',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 300ms ease-in-out'
      }}
      className={className}
    />
  );
}
