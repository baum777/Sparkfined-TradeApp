import { Input } from '@/components/ui/input';
import { useDiscoverStore } from '@/lib/state/discoverStore';
import { Search } from 'lucide-react';

export function DiscoverHeader() {
  const searchQuery = useDiscoverStore((s) => s.filters.searchQuery);
  const setFilters = useDiscoverStore((s) => s.setFilters);

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by symbol, name, or mint..."
          value={searchQuery}
          onChange={(e) => setFilters({ searchQuery: e.target.value })}
          className="pl-9"
        />
      </div>
    </div>
  );
}

