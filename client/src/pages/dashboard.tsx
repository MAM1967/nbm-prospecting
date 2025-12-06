import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { EventCard } from "@/components/dashboard/EventCard";
import { MOCK_EVENTS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

async function fetchEvents() {
  const response = await fetch("/api/events");
  if (!response.ok) throw new Error("Failed to fetch events");
  return response.json();
}

async function runIntelligenceEngine() {
  const response = await fetch("/api/intelligence/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ industry: "Tech, SaaS, B2B software" }),
  });
  if (!response.ok) throw new Error("Failed to run intelligence engine");
  return response.json();
}

export default function Dashboard() {
  const [filter, setFilter] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch events from backend
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
  });

  // Mutation to trigger intelligence engine
  const runEngine = useMutation({
    mutationFn: runIntelligenceEngine,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({
        title: "Intelligence Engine Complete",
        description: `Processed ${data.processed} new events from this week's news.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Engine Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Use mock data if no real events yet
  const displayEvents = events.length > 0 ? events : MOCK_EVENTS;
  const usingMockData = events.length === 0;

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground tracking-tight">Intelligence Feed</h1>
          <p className="text-muted-foreground mt-1">
            Weekly curated signals for <span className="font-medium text-foreground">Tech, SaaS, B2B Software</span>
          </p>
          {usingMockData && (
            <p className="text-xs text-amber-600 mt-2 bg-amber-50 px-2 py-1 rounded inline-block">
              Showing demo data. Click "Run Intelligence Engine" to fetch real news.
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 hidden md:flex">
             <SlidersHorizontal className="h-4 w-4" />
             Filter View
          </Button>
          <Button 
            onClick={() => runEngine.mutate()}
            disabled={runEngine.isPending}
            className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
            data-testid="button-run-engine"
          >
             {runEngine.isPending ? (
               <>
                 <Loader2 className="h-4 w-4 animate-spin" />
                 Processing...
               </>
             ) : (
               <>
                 <Sparkles className="h-4 w-4" />
                 Run Intelligence Engine
               </>
             )}
          </Button>
        </div>
      </div>

      {/* Stats / Quick Glance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
         <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">High Priority Events</p>
            <p className="text-2xl font-mono font-bold text-foreground mt-1">{displayEvents.length}</p>
         </div>
         <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Verified Execs</p>
            <p className="text-2xl font-mono font-bold text-foreground mt-1">
              {displayEvents.reduce((sum: number, e: any) => sum + e.leadership.filter((l: any) => l.verified).length, 0)}
            </p>
         </div>
         <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Avg Impact Score</p>
            <p className="text-2xl font-mono font-bold text-accent mt-1">
              {displayEvents.length > 0 ? Math.round(displayEvents.reduce((sum: number, e: any) => sum + (e.impactScore || 0), 0) / displayEvents.length) : 0}
            </p>
         </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {displayEvents.map((event: any) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
      
      {!isLoading && displayEvents.length > 0 && (
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">You're all caught up for this week.</p>
          <Button variant="link" className="text-primary mt-2">View Archived Signals</Button>
        </div>
      )}

      {!isLoading && displayEvents.length === 0 && (
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">No events detected yet. Run the intelligence engine to start processing news.</p>
          <Button onClick={() => runEngine.mutate()} disabled={runEngine.isPending}>
            {runEngine.isPending ? "Processing..." : "Run Intelligence Engine"}
          </Button>
        </div>
      )}
    </AppLayout>
  );
}
