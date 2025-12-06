import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Settings, 
  Bookmark, 
  Search, 
  Bell, 
  Menu,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import logoImg from "@assets/generated_images/minimalist_geometric_logo_for_prospect_intelligence_engine.png";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  const NavItem = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const isActive = location === href;
    return (
      <Link href={href}>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 px-3 py-6 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200",
            isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-r-2 border-primary rounded-r-none"
          )}
        >
          <Icon className="h-5 w-5" />
          <span className="text-sm tracking-wide">{label}</span>
        </Button>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="p-6 pb-8 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-accent p-0.5 shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
            <div className="h-full w-full rounded-[7px] bg-sidebar flex items-center justify-center overflow-hidden">
               <img src={logoImg} alt="Logo" className="h-full w-full object-cover scale-150" />
            </div>
          </div>
          <div>
            <h1 className="font-heading font-bold text-lg tracking-tight text-white leading-none">PROSPECT</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 font-mono">Intelligence Engine</p>
          </div>
        </div>
      </div>

      <div className="flex-1 py-6 space-y-1">
        <div className="px-4 mb-2">
          <p className="text-xs font-medium text-sidebar-foreground/40 uppercase tracking-widest pl-2">Platform</p>
        </div>
        <NavItem href="/" icon={LayoutDashboard} label="Intelligence Feed" />
        <NavItem href="/saved" icon={Bookmark} label="Saved Signals" />
        
        <div className="px-4 mb-2 mt-8">
          <p className="text-xs font-medium text-sidebar-foreground/40 uppercase tracking-widest pl-2">Configuration</p>
        </div>
        <NavItem href="/onboarding" icon={Settings} label="ICP Settings" />
      </div>

      <div className="p-4 border-t border-sidebar-border/50">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors cursor-pointer">
          <Avatar className="h-9 w-9 border border-sidebar-border">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate text-white">James Dalton</p>
            <p className="text-xs text-muted-foreground truncate">Fractional CMO</p>
          </div>
          <LogOut className="h-4 w-4 text-muted-foreground hover:text-white transition-colors" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-72 shrink-0 fixed inset-y-0 z-20">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar z-30 flex items-center px-4 justify-between border-b border-sidebar-border">
        <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-gradient-to-br from-primary to-accent p-px">
                 <img src={logoImg} alt="Logo" className="h-full w-full object-cover rounded" />
            </div>
            <span className="font-heading font-bold text-white">PROSPECT</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:pl-72 flex flex-col min-h-0 overflow-hidden">
         <header className="h-16 border-b bg-background/80 backdrop-blur-md sticky top-0 z-10 px-8 flex items-center justify-between">
            <div className="flex items-center gap-4 w-full max-w-xl">
               <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Search companies, signals, or executives..." 
                    className="w-full bg-secondary/50 border-none rounded-md py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-muted-foreground/70"
                  />
               </div>
            </div>
            <div className="flex items-center gap-4">
               <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-accent animate-pulse" />
               </Button>
            </div>
         </header>
         <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
            <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               {children}
            </div>
         </div>
      </main>
    </div>
  );
}
