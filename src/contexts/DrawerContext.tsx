import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

// Types
type DrawerType =
  | "client-details"
  | "lead-details"
  | "intervention-triage"
  | "ai-assistant"
  | null;

interface DrawerContextType {
  openDrawer: (type: DrawerType, data?: any) => void;
  closeDrawer: () => void;
  activeDrawer: DrawerType;
  drawerData: any;
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null);
  const [drawerData, setDrawerData] = useState<any>(null);

  const openDrawer = useCallback((type: DrawerType, data?: any) => {
    setActiveDrawer(type);
    setDrawerData(data);
  }, []);

  const closeDrawer = useCallback(() => {
    setActiveDrawer(null);
    setDrawerData(null);
  }, []);

  return (
    <DrawerContext.Provider
      value={{ openDrawer, closeDrawer, activeDrawer, drawerData }}
    >
      {children}

      {/* Global Drawer Shell */}
      <Sheet
        open={!!activeDrawer}
        onOpenChange={(open) => !open && closeDrawer()}
      >
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <DrawerRouter
            type={activeDrawer}
            data={drawerData}
            onClose={closeDrawer}
          />
        </SheetContent>
      </Sheet>
    </DrawerContext.Provider>
  );
}

// Internal Router to pick the content
// note: using dynamic imports here would be smart for performance!
import { Loader2 } from "lucide-react";

// Lazy load the drawer contents to keep bundle small
const ClientDetailDrawer = React.lazy(
  () => import("@/features/crm-clients/components/ClientDetailDrawer"),
);
const LeadDetailDrawer = React.lazy(
  () => import("@/features/sales-operations/components/LeadDetailDrawer"),
);
const AIAssistantDrawer = React.lazy(
  () => import("@/features/ai-brain/components/AIAssistantDrawer"),
);

function DrawerRouter({
  type,
  data,
  onClose,
}: {
  type: DrawerType;
  data: any;
  onClose: () => void;
}) {
  if (!type) return null;

  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      {type === "client-details" && (
        <ClientDetailDrawer clientId={data?.id} onClose={onClose} />
      )}
      {type === "lead-details" && (
        <LeadDetailDrawer leadId={data?.id} onClose={onClose} />
      )}
      {type === "ai-assistant" && (
        <AIAssistantDrawer context={data} onClose={onClose} />
      )}
    </React.Suspense>
  );
}

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error("useDrawer must be used within a DrawerProvider");
  }
  return context;
}
