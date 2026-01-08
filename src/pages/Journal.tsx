import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { ScreenState } from "@/components/layout/ScreenState";
import { useJournalApi } from "@/services/journal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Clock } from "lucide-react";
import { toast } from "sonner";
import { useOffline } from "@/components/offline/OfflineContext";
import {
  WalletGuard,
  JournalSegmentedControl,
  JournalConfirmModal,
  JournalCreateDialog,
  JournalArchiveDialog,
  JournalDeleteDialog,
  JournalEmptyState,
  JournalSkeleton,
  JournalReviewOverlay,
  JournalModeToggle,
  JournalSyncBadge,
  JournalTimelineView,
  JournalInboxView,
  JournalLearnView,
  JournalPlaybookView,
  getStoredJournalMode,
  setStoredJournalMode,
  type JournalMode,
  type JournalView,
  type CreateEntryPayload,
  type ReflectionData,
} from "@/components/journal";
import type { JournalEntryLocal } from "@/services/journal/types";

// localStorage key for view mode persistence (legacy)
const VIEW_MODE_KEY = "journalViewMode";

export default function Journal() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isOnline } = useOffline();
  const {
    pageState,
    entries,
    setEntries,
    confirmEntry,
    archiveEntry,
    deleteEntry,
    restoreEntry,
    syncStatus,
    queueCount,
    retrySync,
  } = useJournalApi();

  // Wallet guard state (stub) - default to true for demo
  const [isWalletConnected, setIsWalletConnected] = useState(true);

  // Journal v3 mode state - URL-driven
  const urlMode = searchParams.get("mode") as JournalMode | null;
  const [mode, setMode] = useState<JournalMode>(() => {
    // URL param takes precedence
    if (urlMode && ["timeline", "inbox", "learn", "playbook"].includes(urlMode)) {
      return urlMode;
    }
    return getStoredJournalMode();
  });
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Legacy view state (for v2 compatibility)
  const [activeView, setActiveView] = useState<JournalView>("pending");

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [confirmModalEntry, setConfirmModalEntry] = useState<JournalEntryLocal | null>(null);
  const [archiveDialogEntry, setArchiveDialogEntry] = useState<JournalEntryLocal | null>(null);
  const [deleteDialogEntry, setDeleteDialogEntry] = useState<JournalEntryLocal | null>(null);

  // Review overlay state
  const [isReviewOverlayOpen, setIsReviewOverlayOpen] = useState(false);
  const [reviewInitialIndex, setReviewInitialIndex] = useState(0);

  // Highlight state
  // (Legacy UI-only state; detail navigation is via /journal/:entryId)

  // Sync errors derived from entries
  const syncErrors = useMemo(() => {
    const errors = new Set<string>();
    entries.forEach(e => {
      if (e._syncError) errors.add(e.id);
    });
    return errors;
  }, [entries]);

  // Counts for segments
  const counts = useMemo(() => ({
    pending: entries.filter((e) => e.status === "pending").length,
    confirmed: entries.filter((e) => e.status === "confirmed").length,
    archived: entries.filter((e) => e.status === "archived").length,
  }), [entries]);

  // All pending entries (for review overlay and banner)
  const pendingEntries = useMemo(() => 
    entries.filter((e) => e.status === "pending")
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [entries]
  );

  // Filter entries for timeline (confirmed + pending)
  const timelineEntries = useMemo(() => {
    let result = entries.filter((e) => e.status === "pending" || e.status === "confirmed");

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.summary.toLowerCase().includes(query) ||
          e.id.toLowerCase().includes(query)
      );
    }

    return result;
  }, [entries, searchQuery]);

  // Note: sync errors are now derived from entries._syncError flag

  // Handle URL ?mode= sync on initial load and changes
  useEffect(() => {
    const modeParam = searchParams.get("mode") as JournalMode | null;
    if (modeParam && ["timeline", "inbox", "learn", "playbook"].includes(modeParam)) {
      if (mode !== modeParam) {
        setMode(modeParam);
        setStoredJournalMode(modeParam);
      }
    }
  }, [searchParams]);

  // Sync mode to URL when changed via toggle
  const handleModeChange = useCallback((newMode: JournalMode) => {
    setMode(newMode);
    setStoredJournalMode(newMode);
    const newParams = new URLSearchParams(searchParams);
    if (newMode !== "timeline") {
      newParams.set("mode", newMode);
    } else {
      newParams.delete("mode");
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Handle URL ?view= sync on initial load (legacy)
  useEffect(() => {
    const viewParam = searchParams.get("view") as JournalView | null;
    if (viewParam && ["pending", "confirmed", "archived"].includes(viewParam)) {
      setActiveView(viewParam);
    }
  }, []);

  // Update URL when view changes
  const handleViewChange = useCallback((view: JournalView) => {
    setActiveView(view);
    const modeParam = searchParams.get("mode");
    const newParams = new URLSearchParams();
    newParams.set("view", view);
    if (modeParam) {
      newParams.set("mode", modeParam);
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Handle row click
  const handleRowClick = useCallback((id: string) => {
    // Canonical: navigate to detail route via path; never represent detail via query params.
    navigate(`/journal/${encodeURIComponent(id)}`);
  }, [navigate]);

  // Handle create entry (diary entry - confirmed by default per spec)
  const handleCreateEntry = useCallback((payload: CreateEntryPayload) => {
    const now = new Date().toISOString();
    const newEntry: JournalEntryLocal = {
      id: `entry-${Date.now()}`,
      side: "BUY", // Diary entries default to BUY
      status: "confirmed", // Diary entries are confirmed by default
      timestamp: now,
      summary: payload.reasoning || `${payload.feeling} · ${payload.confidence}% confident`,
      createdAt: now,
      updatedAt: now,
    };
    setEntries((prev) => [newEntry, ...prev]);
    toast.success("Entry logged");
  }, [setEntries]);
  // Handlers
  const handleConfirm = (id: string) => {
    confirmEntry(id);
    toast.success("Confirmed");
  };

  const handleArchive = (id: string) => {
    archiveEntry(id);
    toast.success("Archived", {
      action: {
        label: "Undo",
        onClick: () => handleRestore(id),
      },
    });
  };

  const handleDelete = (id: string) => {
    deleteEntry(id);
    toast.success("Entry deleted");
  };

  const handleRestore = (id: string) => {
    restoreEntry(id);
    toast.success("Entry restored");
  };

  const handleRetry = () => {
    pageState.setState("loading");
    setTimeout(() => pageState.setState("ready"), 1000);
  };

  const handleDemoMode = () => {
    toast.info("Demo mode activated");
  };

  const handleOpenCreateDialog = useCallback(() => {
    setIsCreateDialogOpen(true);
  }, []);

  // Review overlay handlers
  const handleOpenReviewOverlay = useCallback((index: number = 0) => {
    setReviewInitialIndex(index);
    setIsReviewOverlayOpen(true);
  }, []);

  const handleReviewConfirm = useCallback((id: string) => {
    confirmEntry(id);
    toast.success("Confirmed");
  }, [confirmEntry]);

  const handleReviewArchive = useCallback((id: string) => {
    archiveEntry(id);
    toast.success("Archived", {
      action: {
        label: "Undo",
        onClick: () => handleRestore(id),
      },
    });
  }, [archiveEntry]);

  const handleReviewEdit = useCallback((entry: JournalEntryLocal) => {
    setIsReviewOverlayOpen(false);
    setConfirmModalEntry(entry);
  }, []);

  // Timeline card click handler
  const handleTimelineCardClick = useCallback((entry: JournalEntryLocal, index: number) => {
    if (entry.status === "pending") {
      const pendingIndex = pendingEntries.findIndex((e) => e.id === entry.id);
      if (pendingIndex !== -1) {
        handleOpenReviewOverlay(pendingIndex);
      }
    } else {
      handleRowClick(entry.id);
    }
  }, [pendingEntries, handleOpenReviewOverlay, handleRowClick]);

  // Inbox handlers
  const handleInboxConfirm = useCallback((id: string) => {
    confirmEntry(id);
    toast.success("Confirmed");
  }, [confirmEntry]);

  const handleInboxArchive = useCallback((id: string) => {
    archiveEntry(id);
    toast.success("Archived", {
      action: {
        label: "Undo",
        onClick: () => restoreEntry(id),
      },
    });
  }, [archiveEntry, restoreEntry]);

  const handleInboxSaveNote = useCallback((id: string, reflection: ReflectionData) => {
    // BACKEND_HOOK: Save reflection without confirming
    toast.success("Note saved");
  }, []);

  const handleInboxConfirmWithNote = useCallback((id: string, _reflection: ReflectionData) => {
    // P0.1: confirm takes NO payload per CONTRACTS.md
    confirmEntry(id);
    toast.success("Confirmed with note");
  }, [confirmEntry]);

  // Keyboard shortcuts for Inbox mode
  useEffect(() => {
    if (mode !== "inbox") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only when not in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "j" || e.key === "J") {
        // Focus next card
      } else if (e.key === "k" || e.key === "K") {
        // Focus prev card
      } else if (e.key === "c" || e.key === "C") {
        // Confirm focused
      } else if (e.key === "a" || e.key === "A") {
        // Archive focused
      } else if (e.key === "n" || e.key === "N") {
        // Add note
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

  // Loading state
  if (pageState.isLoading) {
    return (
      <PageContainer testId="page-journal">
        <ScreenState status="loading" loadingVariant={<JournalSkeleton />} />
      </PageContainer>
    );
  }

  // Error state
  if (pageState.isError) {
    return (
      <PageContainer testId="page-journal">
        <ScreenState
          status="error"
          onRetry={handleRetry}
          errorTitle="Failed to load Journal"
          errorMessage="Please try again."
        />
      </PageContainer>
    );
  }

  const isCompletelyEmpty = entries.length === 0;

  return (
    <PageContainer testId="page-journal">
      <WalletGuard isConnected={isWalletConnected} onDemoMode={handleDemoMode}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4">
            {/* Top row: Title + Mode toggle + CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Journal
                </h1>
                <JournalModeToggle
                  value={mode}
                  onChange={handleModeChange}
                  pendingCount={counts.pending}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  data-testid="journal-cta-new-diary"
                  onClick={handleOpenCreateDialog}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Diary Entry
                </Button>
              </div>
            </div>

            {/* Sub-row: Search + Sync + Quick review CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="journal-search"
                  placeholder="Search entries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-3">
                <JournalSyncBadge
                  status={syncStatus}
                  queueCount={queueCount}
                  onRetry={retrySync}
                />

                {counts.pending > 0 && (
                  <Badge
                    data-testid="journal-pending-count"
                    variant="secondary"
                    className="text-xs gap-1 text-amber-500"
                  >
                    <Clock className="h-3 w-3" />
                    {counts.pending} pending
                  </Badge>
                )}

                {counts.pending > 0 && counts.pending <= 5 && (
                  <Button
                    data-testid="journal-cta-review-3min"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenReviewOverlay(0)}
                  >
                    3-min review
                  </Button>
                )}
              </div>
            </div>
          </div>

          {isCompletelyEmpty ? (
            <JournalEmptyState type="all" onLogEntry={handleOpenCreateDialog} />
          ) : (
            <>
              {/* Mode-specific content */}
              {mode === "timeline" && (
                <div className="space-y-4">
                  {/* v2 Segmented Control - advanced filter row */}
                  <JournalSegmentedControl
                    value={activeView}
                    onChange={handleViewChange}
                    counts={counts}
                  />
                  
                  <JournalTimelineView
                    entries={activeView === "archived" 
                      ? entries.filter((e) => e.status === "archived" && (
                          !searchQuery.trim() || 
                          e.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.id.toLowerCase().includes(searchQuery.toLowerCase())
                        ))
                      : timelineEntries
                    }
                    onCardClick={handleTimelineCardClick}
                    onEdit={(entry) => setConfirmModalEntry(entry)}
                    onArchive={(id) => handleArchive(id)}
                    onAddReflection={(entry) => {
                      // Open mini reflection for this entry
                      const idx = pendingEntries.findIndex((e) => e.id === entry.id);
                      if (idx !== -1) {
                        handleOpenReviewOverlay(idx);
                      }
                    }}
                  />
                </div>
              )}

              {mode === "inbox" && (
                <JournalInboxView
                  pendingEntries={pendingEntries}
                  onConfirm={handleInboxConfirm}
                  onArchive={handleInboxArchive}
                  onSaveNote={handleInboxSaveNote}
                  onConfirmWithNote={handleInboxConfirmWithNote}
                  onGoToTimeline={() => handleModeChange("timeline")}
                  syncErrors={syncErrors}
                />
              )}

              {mode === "learn" && (
                <JournalLearnView
                  onStartReview={() => handleOpenReviewOverlay(0)}
                  onShowEvidence={(type, index) => {
                    // Switch to timeline with filter
                    handleModeChange("timeline");
                    toast.info(`Showing ${type} evidence`);
                  }}
                />
              )}

              {mode === "playbook" && (
                <JournalPlaybookView />
              )}
            </>
          )}
        </div>

        {/* Dialogs */}
        <JournalCreateDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onCreate={handleCreateEntry}
        />

        <JournalConfirmModal
          entry={confirmModalEntry}
          isOpen={!!confirmModalEntry}
          onClose={() => setConfirmModalEntry(null)}
          onConfirm={handleConfirm}
        />

        <JournalArchiveDialog
          entry={archiveDialogEntry}
          isOpen={!!archiveDialogEntry}
          onClose={() => setArchiveDialogEntry(null)}
          onArchive={handleArchive}
        />

        <JournalDeleteDialog
          entry={deleteDialogEntry}
          isOpen={!!deleteDialogEntry}
          onClose={() => setDeleteDialogEntry(null)}
          onDelete={handleDelete}
        />

        {/* Review Overlay */}
        <JournalReviewOverlay
          isOpen={isReviewOverlayOpen}
          onClose={() => setIsReviewOverlayOpen(false)}
          pendingEntries={pendingEntries}
          initialIndex={reviewInitialIndex}
          onConfirm={handleReviewConfirm}
          onArchive={handleReviewArchive}
          onEdit={handleReviewEdit}
        />
      </WalletGuard>
    </PageContainer>
  );
}
