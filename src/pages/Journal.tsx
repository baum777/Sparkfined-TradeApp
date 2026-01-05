import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { useJournalApi } from "@/services/journal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RefreshCw, X, Plus, Search, Clock } from "lucide-react";
import { toast } from "sonner";
import { useOffline } from "@/components/offline/OfflineContext";
import {
  WalletGuard,
  JournalSegmentedControl,
  JournalEntryRow,
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

// Alias for backward compatibility with JournalEntryStub interface
type JournalEntryStub = JournalEntryLocal;

// localStorage key for view mode persistence (legacy)
const VIEW_MODE_KEY = "journalViewMode";

export default function Journal() {
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
  const [confirmModalEntry, setConfirmModalEntry] = useState<JournalEntryStub | null>(null);
  const [archiveDialogEntry, setArchiveDialogEntry] = useState<JournalEntryStub | null>(null);
  const [deleteDialogEntry, setDeleteDialogEntry] = useState<JournalEntryStub | null>(null);

  // Review overlay state
  const [isReviewOverlayOpen, setIsReviewOverlayOpen] = useState(false);
  const [reviewInitialIndex, setReviewInitialIndex] = useState(0);

  // Highlight state
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
  const [entryNotFound, setEntryNotFound] = useState<string | null>(null);
  const entryRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const urlProcessedRef = useRef(false);

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
    // Preserve entry param
    const entryParam = searchParams.get("entry");
    if (entryParam) newParams.set("entry", entryParam);
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
    const entryParam = searchParams.get("entry");
    const newParams = new URLSearchParams();
    newParams.set("view", view);
    if (entryParam) newParams.set("entry", entryParam);
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Handle URL ?entry=<id> scroll + highlight
  useEffect(() => {
    if (urlProcessedRef.current) return;

    const entryId = searchParams.get("entry");
    if (!entryId) return;

    const entry = entries.find((e) => e.id === entryId);
    if (!entry) {
      setEntryNotFound(entryId);
      return;
    }

    urlProcessedRef.current = true;
    setEntryNotFound(null);

    if (entry.status !== activeView) {
      setActiveView(entry.status);
      const newParams = new URLSearchParams(searchParams);
      newParams.set("view", entry.status);
      setSearchParams(newParams, { replace: true });
    }

    setTimeout(() => {
      setHighlightedEntryId(entryId);
      const ref = entryRefs.current.get(entryId);
      if (ref) {
        ref.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setTimeout(() => {
        setHighlightedEntryId(null);
      }, 1500);
    }, 100);
  }, [entries, searchParams, activeView, setSearchParams]);

  // Handle row click
  const handleRowClick = useCallback((id: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("entry", id);
    setSearchParams(newParams, { replace: true });

    setHighlightedEntryId(id);
    setTimeout(() => {
      setHighlightedEntryId(null);
    }, 1500);
  }, [searchParams, setSearchParams]);

  // Clear entry not found
  const handleClearEntryNotFound = useCallback(() => {
    setEntryNotFound(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("entry");
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Handle create entry (diary entry - confirmed by default per spec)
  const handleCreateEntry = useCallback((payload: CreateEntryPayload) => {
    const now = new Date().toISOString();
    const newEntry: JournalEntryStub = {
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

    const entryParam = searchParams.get("entry");
    if (entryParam === id) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("entry");
      setSearchParams(newParams, { replace: true });
    }
  };

  const handleArchive = (id: string) => {
    archiveEntry(id);
    toast.success("Archived", {
      action: {
        label: "Undo",
        onClick: () => handleRestore(id),
      },
    });

    const entryParam = searchParams.get("entry");
    if (entryParam === id) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("entry");
      setSearchParams(newParams, { replace: true });
    }
  };

  const handleDelete = (id: string) => {
    deleteEntry(id);
    toast.success("Entry deleted");

    const entryParam = searchParams.get("entry");
    if (entryParam === id) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("entry");
      setSearchParams(newParams, { replace: true });
    }
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

  // Set ref for entry row
  const setEntryRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      entryRefs.current.set(id, el);
    } else {
      entryRefs.current.delete(id);
    }
  }, []);

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

  const handleReviewEdit = useCallback((entry: JournalEntryStub) => {
    setIsReviewOverlayOpen(false);
    setConfirmModalEntry(entry);
  }, []);

  // Timeline card click handler
  const handleTimelineCardClick = useCallback((entry: JournalEntryStub, index: number) => {
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
        <JournalSkeleton />
      </PageContainer>
    );
  }

  // Error state
  if (pageState.isError) {
    return (
      <PageContainer testId="page-journal">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Journal
            </h1>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Failed to load journal entries. Please try again.</span>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
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

          {/* Entry not found alert */}
          {entryNotFound && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Entry "{entryNotFound}" not found in journal.</span>
                <Button variant="outline" size="sm" onClick={handleClearEntryNotFound}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </AlertDescription>
            </Alert>
          )}

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
                    onEdit={(entry) => setConfirmModalEntry(entry as JournalEntryStub)}
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
