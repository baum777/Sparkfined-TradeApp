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
import { WifiOff } from "lucide-react";
import { useOffline } from "@/components/offline/OfflineContext";
import type { JournalEntryLocal } from "@/services/journal/types";

interface JournalDeleteDialogProps {
  entry: JournalEntryLocal | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function JournalDeleteDialog({
  entry,
  isOpen,
  onClose,
  onDelete,
}: JournalDeleteDialogProps) {
  const { isOnline } = useOffline();

  const handleDelete = () => {
    if (!entry || !isOnline) return;
    onDelete(entry.id);
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
          <AlertDialogTitle>Delete Entry</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this entry? This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!isOnline && (
          <Alert variant="destructive" className="mb-4">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              You are offline. Delete action is disabled.
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isOnline}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
