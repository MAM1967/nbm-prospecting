import { motion } from "framer-motion";
import { Check, ArrowRight, Building, ShoppingBag, Heart, Factory, Coffee, Globe, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { INDUSTRIES, Industry } from "@/lib/mock-data";

interface IndustrySelectorProps {
  selected: Industry | null;
  onSelect: (industry: Industry) => void;
}

const INDUSTRY_ICONS: Record<string, any> = {
  "Tech, SaaS, B2B software": Globe,
  "Professional services": Building,
  "E-commerce & DTC brands": ShoppingBag,
  "Healthcare & life sciences": Heart,
  "Manufacturing & distribution": Factory,
  "Hospitality & retail": Coffee,
  "Nonprofits & mission-driven orgs": Users, // Fallback
};

export function IndustrySelector({ selected, onSelect }: IndustrySelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {INDUSTRIES.map((industry, index) => {
        const Icon = INDUSTRY_ICONS[industry] || Globe;
        const isSelected = selected === industry;

        return (
          <motion.button
            key={industry}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(industry)}
            className={cn(
              "relative group flex flex-col items-start p-6 rounded-xl border-2 text-left transition-all duration-200",
              isSelected 
                ? "border-primary bg-primary/5 shadow-md" 
                : "border-border bg-card hover:border-primary/50 hover:bg-secondary/50"
            )}
          >
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center mb-4 transition-colors",
              isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground group-hover:bg-primary/10 group-hover:text-primary"
            )}>
              <Icon className="h-5 w-5" />
            </div>
            
            <h3 className={cn(
              "font-heading font-semibold text-lg mb-2 leading-tight",
              isSelected ? "text-primary" : "text-foreground"
            )}>
              {industry}
            </h3>
            
            <p className="text-sm text-muted-foreground">
               Track relevant signals for {industry.toLowerCase()} including bespoke event triggers.
            </p>

            {isSelected && (
              <div className="absolute top-4 right-4 h-6 w-6 rounded-full bg-primary flex items-center justify-center animate-in zoom-in-50">
                <Check className="h-3.5 w-3.5 text-white" />
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
