import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsSectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  variant?: "default" | "danger";
}

export function SettingsSectionCard({
  title,
  description,
  children,
  variant = "default",
}: SettingsSectionCardProps) {
  return (
    <Card
      className={cn(
        variant === "danger" && "border-destructive/50 bg-destructive/5"
      )}
    >
      <CardHeader className="pb-4">
        <CardTitle
          className={cn(
            "text-base",
            variant === "danger" && "text-destructive"
          )}
        >
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-sm">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
