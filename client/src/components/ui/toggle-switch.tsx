import React from "react";

interface ToggleSwitchProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  activeColor?: "purple" | "blue" | "emerald";
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
  size?: "sm" | "md";
}

export function ToggleSwitch({
  id,
  checked,
  onCheckedChange,
  label,
  activeColor = "purple",
  disabled = false,
  className = "",
  "data-testid": dataTestId,
  size = "md",
}: ToggleSwitchProps) {
  const colorMap = {
    purple: {
      active: "bg-purple-600 dark:bg-purple-500",
      icon: "🎨",
    },
    blue: {
      active: "bg-blue-600 dark:bg-blue-500",
      icon: "🎬",
    },
    emerald: {
      active: "bg-emerald-600 dark:bg-emerald-500",
      icon: "📝",
    },
  };

  const colors = colorMap[activeColor] || colorMap.purple;

  const sizeClasses = {
    sm: {
      container: "h-5 w-9",
      thumb: "h-4 w-4",
      checkedPos: { left: "auto", right: "2px" },
      uncheckedPos: { left: "2px", right: "auto" }
    },
    md: {
      container: "h-7 w-14",
      thumb: "h-6 w-6",
      checkedPos: { left: "auto", right: "2px" },
      uncheckedPos: { left: "2px", right: "auto" }
    }
  };

  const sizeConfig = sizeClasses[size] || sizeClasses.md;

  return (
    <div className="flex items-center gap-3">
      <button
        id={id}
        type="button"
        onClick={() => !disabled && onCheckedChange(!checked)}
        disabled={disabled}
        className={`
          relative inline-flex items-center rounded-full
          transition-all duration-300 ease-in-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${sizeConfig?.container || "h-7 w-14"}
          ${
            checked
              ? colors?.active || "bg-purple-600 dark:bg-purple-500"
              : "bg-gray-400 dark:bg-gray-500"
          }
          ${className}
        `}
        data-testid={dataTestId}
      >
        {/* Thumb */}
        <div
          className={`
            absolute rounded-full
            bg-white dark:bg-white shadow-md
            transition-all duration-300 ease-in-out
            ${sizeConfig?.thumb || "h-6 w-6"}
          `}
          style={checked ? sizeConfig.checkedPos : sizeConfig.uncheckedPos}
        />
      </button>

      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium cursor-pointer select-none"
        >
          {label}
        </label>
      )}
    </div>
  );
}
