import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Cpu, Sparkles } from "lucide-react";

interface Provider {
  id: number;
  name: string;
  isActive: boolean;
}

interface Model {
  id: number;
  providerId?: number;
  modelName?: string;
  displayName: string;
}

interface ProviderModelSelectorProps {
  providers: Provider[];
  models: Model[];
  selectedProviderId: number | null;
  selectedModelId: number | null;
  onProviderChange: (providerId: number | null) => void;
  onModelChange: (modelId: number | null) => void;
  providerLabel?: string;
  modelLabel?: string;
}

export function ProviderModelSelector({
  providers,
  models,
  selectedProviderId,
  selectedModelId,
  onProviderChange,
  onModelChange,
  providerLabel = "مزود الخدمة",
  modelLabel = "النموذج"
}: ProviderModelSelectorProps) {
  const getProviderDisplayName = (name: string) => {
    switch (name) {
      case "groq": return "Groq (سريع)";
      case "huggingface": return "HuggingFace";
      case "openai": return "OpenAI";
      case "claude": return "Claude";
      default: return name;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          {providerLabel}
        </Label>
        <Select
          value={selectedProviderId?.toString() || ""}
          onValueChange={(value) => {
            onProviderChange(value ? parseInt(value) : null);
            onModelChange(null);
          }}
        >
          <SelectTrigger className="h-11 border rounded-lg bg-background hover:bg-muted/50 transition-colors">
            <SelectValue placeholder="اختر مزود الخدمة" />
          </SelectTrigger>
          <SelectContent>
            {providers.filter((p) => p.isActive).map((provider) => (
              <SelectItem 
                key={provider.id} 
                value={provider.id.toString()}
              >
                {getProviderDisplayName(provider.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          {modelLabel}
        </Label>
        <Select
          value={selectedModelId?.toString() || ""}
          onValueChange={(value) => onModelChange(value ? parseInt(value) : null)}
          disabled={!selectedProviderId}
        >
          <SelectTrigger className="h-11 border rounded-lg bg-background hover:bg-muted/50 transition-colors">
            <SelectValue placeholder={selectedProviderId ? "اختر النموذج" : "اختر مزود الخدمة أولاً"} />
          </SelectTrigger>
          <SelectContent>
            {models.filter((model) => !selectedProviderId || model.providerId === selectedProviderId).map((model) => (
              <SelectItem key={model.id} value={model.id.toString()}>
                {model.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
