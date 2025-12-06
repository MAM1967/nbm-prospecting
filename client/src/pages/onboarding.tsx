import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { IndustrySelector } from "@/components/dashboard/IndustrySelector";
import { Industry } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import logoImg from "@assets/generated_images/minimalist_geometric_logo_for_prospect_intelligence_engine.png";
import { Badge } from "@/components/ui/badge";

export default function Onboarding() {
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const [step, setStep] = useState(1);
  const [_, setLocation] = useLocation();

  const handleContinue = () => {
    if (step === 1 && selectedIndustry) {
      setStep(2);
      // Simulate "Configuring Engine" delay
      setTimeout(() => {
        setLocation("/");
      }, 2500);
    }
  };

  if (step === 2) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6 max-w-md"
        >
          <div className="relative mx-auto h-24 w-24">
             <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
             <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
             <div className="absolute inset-2 rounded-full bg-card flex items-center justify-center shadow-lg">
                <img src={logoImg} className="h-10 w-10 object-contain" />
             </div>
          </div>
          <div>
            <h2 className="text-2xl font-heading font-bold text-foreground">Configuring Engine</h2>
            <p className="text-muted-foreground mt-2">
              Calibrating signal detection for <span className="text-primary font-medium">{selectedIndustry}</span>...
            </p>
          </div>
          <div className="space-y-2 pt-4">
             <div className="flex items-center gap-3 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Loading news sources...</span>
             </div>
             <div className="flex items-center gap-3 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500 delay-1000">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Identifying key players...</span>
             </div>
             <div className="flex items-center gap-3 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500 delay-2000">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Generating conversation starters...</span>
             </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-8 py-6 border-b border-border">
         <div className="flex items-center gap-2">
             <div className="h-8 w-8 rounded bg-gradient-to-br from-primary to-accent p-px">
                 <img src={logoImg} alt="Logo" className="h-full w-full object-cover rounded" />
            </div>
            <span className="font-heading font-bold text-lg">PROSPECT</span>
         </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12 max-w-6xl">
        <div className="mb-12 text-center max-w-2xl mx-auto">
          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">Step 1 of 2</Badge>
          <h1 className="text-4xl font-heading font-bold text-foreground mb-4">Select your Industry Vertical</h1>
          <p className="text-lg text-muted-foreground">
            The engine tailors its news ingestion, event detection, and conversation starters based on your target market.
          </p>
        </div>

        <IndustrySelector 
          selected={selectedIndustry} 
          onSelect={setSelectedIndustry} 
        />

        <div className="mt-12 flex justify-center">
          <Button 
            size="lg" 
            className="px-8 gap-2 text-lg h-14"
            disabled={!selectedIndustry}
            onClick={handleContinue}
          >
            Initialize Engine
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </main>
    </div>
  );
}
