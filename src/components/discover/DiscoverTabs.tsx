import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDiscoverStore } from '@/lib/state/discoverStore';
import { DiscoverFiltersPanel } from './DiscoverFiltersPanel';
import { DiscoverTokenList } from './DiscoverTokenList';

export function DiscoverTabs() {
  const activeTab = useDiscoverStore((s) => s.activeTab);
  const setActiveTab = useDiscoverStore((s) => s.setActiveTab);

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex h-full flex-col">
      <div className="border-b px-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="not_bonded">Not Bonded</TabsTrigger>
          <TabsTrigger value="bonded">Bonded</TabsTrigger>
          <TabsTrigger value="ranked">Ranked</TabsTrigger>
        </TabsList>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* Left: Filters Panel */}
        <div className="w-64 shrink-0">
          <DiscoverFiltersPanel />
        </div>

        {/* Right: Token List */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="not_bonded" className="h-full m-0">
            <DiscoverTokenList tab="not_bonded" />
          </TabsContent>
          <TabsContent value="bonded" className="h-full m-0">
            <DiscoverTokenList tab="bonded" />
          </TabsContent>
          <TabsContent value="ranked" className="h-full m-0">
            <DiscoverTokenList tab="ranked" />
          </TabsContent>
        </div>
      </div>
    </Tabs>
  );
}

