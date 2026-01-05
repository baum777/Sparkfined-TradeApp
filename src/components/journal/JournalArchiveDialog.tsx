import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WifiOff } from "lucide-react";
import { useOffline } from "@/components/offline/OfflineContext";
import type { JournalEntryStub } from "@/stubs/contracts";

// NOTE: Archive reason is local-only by contract.
// POST /api/journal/:id/archive sends NO request body per CONTRACTS.md.
// The reason is collected for potential future use or local analytics only.
const ARCHIVE_REASONS = [
  { value: "market_changed", label: "Market conditions changed" },
  { value: "invalid_setup", label: "Invalid setup" },
  { value: "missed_entry", label: "Missed entry" },
  { value: "duplicate", label: "Duplicate entry" },
  { value: "other", label: "Other" },
];

interface JournalArchiveDialogProps {
  entry: JournalEntryStub | null;
  isOpen: boolean;
  onClose: () => void;
  onArchive: (id: string, reason: string) => void;
}

export function JournalArchiveDialog({
  entry,
  isOpen,
  onClose,
  onArchive,
}: JournalArchiveDialogProps) {
  const { isOnline } = useOffline();
  const [reason, setReason] = useState("market_changed");

  const handleArchive = () => {
    if (!entry || !isOnline) return;
    onArchive(entry.id, reason);
    setReason("market_changed");
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive Entry</AlertDialogTitle>
          <AlertDialogDescription>
            This entry will be moved to the archived section. You can restore it
            later if needed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <div className="space-y-2">
            <Label htmlFor="archive-reason">Reason for archiving</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="archive-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ARCHIVE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!isOnline && (
          <Alert variant="destructive" className="mb-4">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              You are offline. Archive action is disabled.
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleArchive} disabled={!isOnline}>
            Archive
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
