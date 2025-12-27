import { useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";

interface RuleSectionProps {
  title: string;
  description: string;
  icon: ReactNode;
  color: string;
  bgColor: string;
  isEnabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  count?: number;
  onAdd?: () => void;
  addLabel?: string;
  children: ReactNode;
  settingsPanel?: ReactNode;
}

export function RuleSection({
  title,
  description,
  icon,
  color,
  bgColor,
  isEnabled,
  onToggleEnabled,
  count = 0,
  onAdd,
  addLabel = "إضافة",
  children,
  settingsPanel
}: RuleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className={`overflow-hidden border-2 transition-all duration-300 ${isEnabled ? 'shadow-lg' : ''}`}>
      <div 
        className={`relative flex items-center justify-between p-5 cursor-pointer transition-all duration-300 ${
          isEnabled ? `bg-gradient-to-l ${bgColor}` : 'bg-muted/20 hover:bg-muted/30'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isEnabled && (
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-l from-slate-500 to-slate-600 dark:from-slate-400 dark:to-slate-500" />
        )}
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl transition-all shadow-md ${isEnabled ? 'bg-white/70 dark:bg-black/30' : 'bg-muted'}`}>
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className={`font-bold text-base ${isEnabled ? color : 'text-muted-foreground'}`}>{title}</h3>
              {count > 0 && (
                <Badge className={`text-xs font-bold ${isEnabled ? 'bg-white/50 dark:bg-black/30 text-foreground' : ''}`}>
                  {count} قاعدة
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            isEnabled 
              ? 'bg-white/50 dark:bg-black/30 text-foreground' 
              : 'bg-muted text-muted-foreground'
          }`}>
            {isEnabled ? 'مفعّل' : 'معطّل'}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <ToggleSwitch
              checked={isEnabled}
              onCheckedChange={(checked) => {
                onToggleEnabled(checked);
                if (checked) setIsExpanded(true);
              }}
              size="sm"
            />
          </div>
          <div className={`p-2 rounded-lg transition-all ${isEnabled ? 'bg-white/50 dark:bg-black/20' : 'bg-muted'}`}>
            {isExpanded ? (
              <ChevronUp className={`h-5 w-5 transition-colors ${isEnabled ? color : 'text-muted-foreground'}`} />
            ) : (
              <ChevronDown className={`h-5 w-5 transition-colors ${isEnabled ? color : 'text-muted-foreground'}`} />
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && isEnabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-5 border-t-2 space-y-5 bg-gradient-to-b from-muted/20 to-transparent">
              {settingsPanel && (
                <div className="p-5 rounded-xl bg-gradient-to-br from-muted/40 to-muted/20 border-2 border-dashed space-y-4">
                  {settingsPanel}
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  القواعد المخصصة
                </h4>
                {onAdd && (
                  <Button size="sm" onClick={onAdd} className="h-9 gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white font-semibold shadow-md">
                    <Plus className="h-4 w-4" />
                    {addLabel}
                  </Button>
                )}
              </div>
              
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
