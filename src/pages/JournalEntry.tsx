import { Link, useParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useJournalApi } from "@/services/journal";

export default function JournalEntry() {
  const { entryId } = useParams<{ entryId: string }>();
  const { entries } = useJournalApi();

  const id = entryId?.trim() ?? "";
  const entry = id ? entries.find((e) => e.id === id) : undefined;

  if (!id || !entry) {
    return (
      <PageContainer testId="page-journal-entry">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Journal Entry
          </h1>
          <p className="text-sm text-muted-foreground">
            {id
              ? `Entry "${id}" wurde nicht gefunden.`
              : "Kein entryId Parameter angegeben."}
          </p>
          <Button asChild>
            <Link to="/journal">Zurück zum Journal</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer testId="page-journal-entry">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Journal Entry
          </h1>
          <Button asChild variant="outline">
            <Link to="/journal">Zurück zum Journal</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-sm">{entry.id}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Status: </span>
              <span className="font-medium">{entry.status}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Side: </span>
              <span className="font-medium">{entry.side}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Timestamp: </span>
              <span className="font-medium">{entry.timestamp}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Summary: </span>
              <span className="font-medium">{entry.summary}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

