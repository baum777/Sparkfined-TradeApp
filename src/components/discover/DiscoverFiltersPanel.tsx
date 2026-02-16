import { useDiscoverStore } from '@/lib/state/discoverStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { filterSpec } from '@/features/discover/filter/spec';
import type { PresetId } from '@/features/discover/filter/types';

const LAUNCHPADS = ['pumpfun', 'moonshot'] as const;
const TIME_WINDOWS = [
  { label: 'All Time', value: 'all' },
  { label: 'Last 5m', value: '5m' },
  { label: 'Last 15m', value: '15m' },
  { label: 'Last 60m', value: '60m' },
] as const;

export function DiscoverFiltersPanel() {
  const activeTab = useDiscoverStore((s) => s.activeTab);
  const filters = useDiscoverStore((s) => s.filters);
  const setFilters = useDiscoverStore((s) => s.setFilters);
  const selectedPreset = useDiscoverStore((s) => s.selectedPreset[activeTab]);
  const setStorePreset = useDiscoverStore((s) => s.setPreset);
  
  // Get available presets from spec
  const availablePresets = filterSpec.ui.overlay_tabs[activeTab].user_selectable_presets;
  
  const presetLabels: Record<PresetId, string> = {
    strict_safety_gate: 'Strict Safety Gate',
    bundler_exclusion_gate: 'Bundler Exclusion',
    organic_momentum: 'Organic Momentum',
    deployer_reputation_gate: 'Deployer Reputation',
    signal_fusion: 'Signal Fusion',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset Selector */}
        <div>
          <Label>Preset Profile</Label>
          <Select
            value={selectedPreset}
            onValueChange={(value) => {
              setStorePreset(activeTab, value as PresetId);
            }}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availablePresets.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {presetLabels[preset]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Launchpad Multi-Select */}
        <div>
          <Label>Launchpad</Label>
          <div className="mt-2 space-y-2">
            {LAUNCHPADS.map((launchpad) => (
              <div key={launchpad} className="flex items-center space-x-2">
                <Checkbox
                  id={`launchpad-${launchpad}`}
                  checked={filters.launchpads.includes(launchpad)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setFilters({
                        launchpads: [...filters.launchpads, launchpad],
                      });
                    } else {
                      setFilters({
                        launchpads: filters.launchpads.filter((l) => l !== launchpad),
                      });
                    }
                  }}
                />
                <Label
                  htmlFor={`launchpad-${launchpad}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {launchpad}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Time Window */}
        <div>
          <Label>Time Window</Label>
          <Select
            value={filters.timeWindow}
            onValueChange={(value) =>
              setFilters({ timeWindow: value as typeof filters.timeWindow })
            }
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_WINDOWS.map((tw) => (
                <SelectItem key={tw.value} value={tw.value}>
                  {tw.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Min Liquidity */}
        <div>
          <Label>Min Liquidity (SOL)</Label>
          <Input
            type="number"
            placeholder="0"
            value={filters.minLiquiditySol ?? ''}
            onChange={(e) =>
              setFilters({
                minLiquiditySol: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="mt-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}

