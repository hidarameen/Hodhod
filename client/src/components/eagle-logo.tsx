export function EagleLogo({ 
  size = 40, 
  flip = false,
  className = "" 
}: { 
  size?: number
  flip?: boolean
  className?: string 
}) {
  return (
    <img 
      src="/attached_assets/generated_images/eagle-logo.png"
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
