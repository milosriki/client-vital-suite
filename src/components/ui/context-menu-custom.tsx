import * as React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Phone, Mail, ExternalLink, Copy, User, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ClientContextMenuProps {
  children: React.ReactNode;
  clientName?: string;
  email?: string;
  phone?: string;
  hubspotId?: string;
  onViewProfile?: () => void;
}

export function ClientContextMenu({
  children,
  clientName,
  email,
  phone,
  hubspotId,
  onViewProfile,
}: ClientContextMenuProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  const openHubSpot = () => {
    if (hubspotId) {
      window.open(`https://app.hubspot.com/contacts/27656685/contact/${hubspotId}`, '_blank');
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onViewProfile} className="gap-2">
          <Eye className="h-4 w-4" />
          View Profile
        </ContextMenuItem>
        {phone && (
          <ContextMenuItem onClick={() => window.open(`tel:${phone}`)} className="gap-2">
            <Phone className="h-4 w-4" />
            Call
          </ContextMenuItem>
        )}
        {email && (
          <ContextMenuItem onClick={() => window.open(`mailto:${email}`)} className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        {hubspotId && (
          <ContextMenuItem onClick={openHubSpot} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            View in HubSpot
          </ContextMenuItem>
        )}
        {email && (
          <ContextMenuItem onClick={() => copyToClipboard(email, "Email")} className="gap-2">
            <Copy className="h-4 w-4" />
            Copy Email
          </ContextMenuItem>
        )}
        {phone && (
          <ContextMenuItem onClick={() => copyToClipboard(phone, "Phone")} className="gap-2">
            <Copy className="h-4 w-4" />
            Copy Phone
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface PhoneContextMenuProps {
  children: React.ReactNode;
  phone: string;
  onSearch?: () => void;
}

export function PhoneContextMenu({ children, phone, onSearch }: PhoneContextMenuProps) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(phone);
    toast({ title: "Copied", description: "Phone number copied" });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => window.open(`tel:${phone}`)} className="gap-2">
          <Phone className="h-4 w-4" />
          Call
        </ContextMenuItem>
        <ContextMenuItem onClick={copyToClipboard} className="gap-2">
          <Copy className="h-4 w-4" />
          Copy Number
        </ContextMenuItem>
        {onSearch && (
          <ContextMenuItem onClick={onSearch} className="gap-2">
            <User className="h-4 w-4" />
            Search This Number
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
