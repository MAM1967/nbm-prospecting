import { motion } from "framer-motion";
import { 
  Building2, 
  CalendarDays, 
  ArrowUpRight, 
  Briefcase, 
  UserCheck, 
  MessageSquareQuote,
  TrendingUp,
  Megaphone,
  Users,
  Copy,
  Check
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { IntelligenceEvent, MOCK_EVENTS } from "@/lib/mock-data";

// Import generated logos
import logo1 from "@assets/generated_images/abstract_tech_company_logo_1.png";
import logo2 from "@assets/generated_images/abstract_tech_company_logo_2.png";
import logo3 from "@assets/generated_images/abstract_tech_company_logo_3.png";

const LOGO_MAP: Record<string, string> = {
  "tech": logo1,
  "logistics": logo2,
  "health": logo3
};

interface EventCardProps {
  event: IntelligenceEvent;
}

const EVENT_TYPE_STYLES = {
  rebrand: { label: "Rebrand", color: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800", icon: Megaphone },
  new_exec_hire: { label: "Executive Hire", color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800", icon: Users },
  thought_leadership_spike: { label: "Thought Leadership", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800", icon: TrendingUp },
  hiring_surge: { label: "Hiring Surge", color: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800", icon: TrendingUp },
  m_and_a: { label: "M&A Activity", color: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800", icon: Building2 },
  office_expansion: { label: "Expansion", color: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800", icon: Building2 },
};

export function EventCard({ event }: EventCardProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const style = EVENT_TYPE_STYLES[event.eventType] || EVENT_TYPE_STYLES.rebrand;
  const Icon = style.icon;
  const logoSrc = event.logoPlaceholder ? LOGO_MAP[event.logoPlaceholder] : logo1;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-card border border-border/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
    >
      {/* Top Border Accent */}
      <div className={cn("absolute top-0 left-0 right-0 h-1", style.color.split(" ")[0].replace("bg-", "bg-opacity-100 bg-"))} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg border border-border p-1 bg-white">
              <img src={logoSrc} alt={event.companyName} className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-heading font-semibold text-foreground">{event.companyName}</h3>
                <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="text-sm text-muted-foreground font-mono">{event.companyDomain}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className={cn("font-medium px-3 py-1 flex items-center gap-1.5", style.color)}>
              <Icon className="h-3.5 w-3.5" />
              {style.label}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {event.date}
            </span>
          </div>
        </div>

        {/* Summary */}
        <p className="text-foreground/80 leading-relaxed mb-6">
          {event.summary}
        </p>

        {/* Issues Tags */}
        <div className="flex flex-wrap gap-2 mb-6">
          {event.issues.map((issue) => (
            <span 
              key={issue} 
              className="px-2.5 py-1 rounded-md bg-secondary/50 text-secondary-foreground text-xs font-medium border border-secondary"
            >
              {issue}
            </span>
          ))}
        </div>

        <Separator className="my-4" />

        {/* Actionable Intelligence Accordion */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="starters" className="border-none">
            <AccordionTrigger className="hover:no-underline py-2">
              <div className="flex items-center gap-2 text-primary font-medium">
                <MessageSquareQuote className="h-4 w-4" />
                <span>Verified Leads & Conversation Starters</span>
                <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary hover:bg-primary/20">{event.starters.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 mt-2">
                {event.starters.map((starter, idx) => {
                  const leader = event.leadership.find(l => l.title.includes(starter.role) || starter.role.includes(l.title));
                  const uniqueId = `${event.id}-starter-${idx}`;
                  
                  return (
                    <div key={idx} className="bg-muted/30 rounded-lg p-4 border border-border/50">
                      {/* Target Persona */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                           <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                             {leader ? leader.name.charAt(0) : starter.role.charAt(0)}
                           </div>
                           <div>
                             <p className="text-sm font-semibold text-foreground">
                               {leader ? leader.name : "Target Role"}
                             </p>
                             <div className="flex items-center gap-1.5">
                               <p className="text-xs text-muted-foreground">{starter.role}</p>
                               {leader?.verified && (
                                 <Tooltip>
                                   <TooltipTrigger>
                                     <UserCheck className="h-3 w-3 text-emerald-500" />
                                   </TooltipTrigger>
                                   <TooltipContent>Verified Employee</TooltipContent>
                                 </Tooltip>
                               )}
                             </div>
                           </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopy(starter.starter, uniqueId)}
                        >
                          {copiedId === uniqueId ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      
                      {/* The Script */}
                      <div className="relative group/script">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent/50 rounded-full" />
                        <p className="pl-4 text-sm text-foreground/90 italic font-medium leading-relaxed">
                          "{starter.starter}"
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
      
      {/* Footer / Impact Score */}
      <div className="bg-muted/20 px-6 py-3 border-t border-border flex items-center justify-between">
         <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Detected via {event.sourceUrl.split('/')[2]}
         </span>
         <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Impact Score</span>
            <div className="h-1.5 w-16 bg-secondary rounded-full overflow-hidden">
               <div 
                 className="h-full bg-gradient-to-r from-primary to-accent" 
                 style={{ width: `${event.impactScore}%` }} 
               />
            </div>
            <span className="text-xs font-mono font-bold text-primary">{event.impactScore}</span>
         </div>
      </div>
    </motion.div>
  );
}
