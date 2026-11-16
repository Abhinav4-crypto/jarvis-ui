import React, { useState } from 'react';
import {
  Battery,
  BatteryCharging,
  Cpu,
  HardDrive,
  Mic,
  RefreshCw,
  Wifi,
} from 'lucide-react';
import { useJarvis } from '../context/JarvisContext';
import { Button } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusIndicator } from '../components/ui/StatusIndicator';

function formatGb(bytes: number | null): string {
  if (bytes === null) return 'Unavailable';
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function CircularGauge({
  label,
  percent,
  available,
  subtitle,
}: {
  label: string;
  percent: number | null;
  available: boolean;
  subtitle: string;
}) {
  const safePct = available && percent !== null ? Math.min(100, Math.max(0, percent)) : 0;
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePct / 100) * circumference;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative w-28 h-28 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 108 108">
          <circle
            cx="54"
            cy="54"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-amber-950/10 dark:text-white/[0.08]"
          />
          <circle
            cx="54"
            cy="54"
            r={radius}
            fill="none"
            stroke="url(#gaugeGrad)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300"
          />
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
          </defs>
        </svg>
        <span className="absolute font-mono tabular-nums text-lg font-bold text-[#171411] dark:text-[#FAF6EE]">
          {available && percent !== null ? `${percent}%` : 'N/A'}
        </span>
      </div>
      <p className="mt-2 font-display text-sm font-semibold text-[#171411] dark:text-[#FAF6EE]">
        {label}
      </p>
      <p className="text-xs text-stone-600 dark:text-stone-400 font-mono tabular-nums">
        {subtitle}
      </p>
    </div>
  );
}

export function SystemMonitorPage() {
  const { systemHealth, refreshSystemHealth, activityLog, settings } = useJarvis();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSystemHealth();
    setTimeout(() => setRefreshing(false), 250);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-page-enter pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#171411] dark:text-[#FAF6EE]">
            System Monitor
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5 tabular-nums">
            {systemHealth.hostname} · {systemHealth.osDistro} · Updated {systemHealth.lastRefreshedAt}
          </p>
        </div>

        <Button
          variant="primary"
          icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
          onClick={handleRefresh}
        >
          Refresh Metrics
        </Button>
      </div>

      {systemHealth.telemetryError && (
        <GlassCard padding="sm" className="border-red-500/35 text-xs text-red-700 dark:text-red-300">
          Telemetry Warning: {systemHealth.telemetryError}
        </GlassCard>
      )}

      {/* Real CPU, RAM & Total Storage Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <GlassCard padding="lg" className="flex flex-col items-center justify-between gap-3">
          <CircularGauge
            label="CPU Usage"
            percent={systemHealth.cpu.usagePercent}
            available={systemHealth.cpu.available}
            subtitle={
              systemHealth.cpu.cores
                ? `${systemHealth.cpu.cores} logical cores${
                    systemHealth.cpu.speedGhz ? ` · ${systemHealth.cpu.speedGhz} GHz` : ''
                  }`
                : systemHealth.cpu.error || 'Unavailable'
            }
          />
          <div className="w-full pt-3 border-t border-amber-900/10 dark:border-white/[0.06] flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 gap-2">
            <span className="inline-flex items-center gap-1.5 shrink-0">
              <Cpu className="w-3.5 h-3.5 text-amber-500" />
              <span>Processor</span>
            </span>
            <span className="truncate text-right">{systemHealth.cpu.model}</span>
          </div>
        </GlassCard>

        <GlassCard padding="lg" className="flex flex-col items-center justify-between gap-3">
          <CircularGauge
            label="RAM Usage"
            percent={systemHealth.ram.usagePercent}
            available={systemHealth.ram.available}
            subtitle={
              systemHealth.ram.available
                ? `${formatGb(systemHealth.ram.usedBytes)} used / ${formatGb(
                    systemHealth.ram.totalBytes
                  )}`
                : systemHealth.ram.error || 'Unavailable'
            }
          />
          <div className="w-full pt-3 border-t border-amber-900/10 dark:border-white/[0.06] flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
            <span className="inline-flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-amber-500" />
              <span>Available RAM</span>
            </span>
            <span className="font-mono tabular-nums text-amber-700 dark:text-amber-300">
              {formatGb(systemHealth.ram.availableBytes)}
            </span>
          </div>
        </GlassCard>

        <GlassCard padding="lg" className="flex flex-col items-center justify-between gap-3">
          <CircularGauge
            label="Total Storage"
            percent={systemHealth.storage.usagePercent}
            available={systemHealth.storage.available}
            subtitle={
              systemHealth.storage.available
                ? `${formatGb(systemHealth.storage.usedBytes)} used / ${formatGb(
                    systemHealth.storage.totalBytes
                  )}`
                : systemHealth.storage.error || 'Unavailable'
            }
          />
          <div className="w-full pt-3 border-t border-amber-900/10 dark:border-white/[0.06] flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
            <span>Free Space</span>
            <span className="font-mono tabular-nums text-amber-700 dark:text-amber-300">
              {formatGb(systemHealth.storage.freeBytes)}
            </span>
          </div>
        </GlassCard>
      </div>

      {/* Drive-wise Breakdown + Battery & Network */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <GlassCard padding="md" className="lg:col-span-7 space-y-4">
          <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
            Mounted Drives
          </h2>
          {!systemHealth.storage.available || systemHealth.storage.drives.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-4">
              {systemHealth.storage.error || 'No mounted drives reported by OS.'}
            </p>
          ) : (
            <div className="space-y-3">
              {systemHealth.storage.drives.map((drive) => (
                <div
                  key={`${drive.mount}-${drive.fs}`}
                  className="rounded-xl border border-amber-900/10 dark:border-white/[0.08] p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#171411] dark:text-[#FAF6EE]">
                      {drive.mount} ({drive.type})
                    </span>
                    <span className="font-mono tabular-nums text-stone-600 dark:text-stone-300">
                      {formatGb(drive.usedBytes)} used · {formatGb(drive.freeBytes)} free ·{' '}
                      {formatGb(drive.sizeBytes)} total ({drive.usedPercent}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-amber-950/10 dark:bg-white/[0.06] overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, drive.usedPercent)}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Battery & Network Status */}
        <GlassCard padding="md" className="lg:col-span-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
            Power & Network
          </h2>

          <div className="rounded-xl border border-amber-900/10 dark:border-white/[0.08] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-2 font-medium text-[#171411] dark:text-[#FAF6EE]">
                {systemHealth.battery.isCharging ? (
                  <BatteryCharging className="w-4 h-4 text-amber-500" />
                ) : (
                  <Battery className="w-4 h-4 text-amber-500" />
                )}
                <span>Battery</span>
              </span>
              <span className="font-mono tabular-nums text-amber-700 dark:text-amber-300 font-semibold">
                {!systemHealth.battery.available
                  ? 'Unavailable'
                  : systemHealth.battery.hasBattery && systemHealth.battery.percent !== null
                    ? `${systemHealth.battery.percent}% · ${
                        systemHealth.battery.isCharging ? 'Charging' : 'On Battery'
                      }`
                    : 'AC Power / No Battery'}
              </span>
            </div>
            {systemHealth.battery.hasBattery &&
              systemHealth.battery.timeRemainingMinutes !== null &&
              systemHealth.battery.timeRemainingMinutes > 0 && (
                <p className="text-[11px] text-stone-500 dark:text-stone-400 font-mono tabular-nums">
                  Est. remaining: {systemHealth.battery.timeRemainingMinutes} min
                </p>
              )}
          </div>

          <div className="rounded-xl border border-amber-900/10 dark:border-white/[0.08] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-2 font-medium text-[#171411] dark:text-[#FAF6EE]">
                <Wifi className="w-4 h-4 text-amber-500" />
                <span>Network</span>
              </span>
              <StatusIndicator
                label={systemHealth.network.online ? 'Online' : 'Offline'}
                state={systemHealth.network.online ? 'connected' : 'disconnected'}
              />
            </div>

            {systemHealth.network.interfaces.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-amber-900/10 dark:border-white/[0.06]">
                {systemHealth.network.interfaces.slice(0, 4).map((iface) => (
                  <div
                    key={`${iface.iface}-${iface.ip4}`}
                    className="flex items-center justify-between text-[11px] font-mono text-stone-600 dark:text-stone-400"
                  >
                    <span>
                      {iface.iface} ({iface.type})
                    </span>
                    <span>
                      {iface.ip4 || 'No IP'} · {iface.operstate}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Real Connection Status Checklist & System Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <GlassCard padding="md" className="lg:col-span-6 space-y-3">
          <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
            Service & Hardware Connection Status
          </h2>

          <div className="divide-y divide-amber-900/10 dark:divide-white/[0.06] text-xs">
            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="font-medium">JARVIS Backend</span>
              <StatusIndicator label="Backend" state={systemHealth.jarvisBackendStatus} />
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="font-medium">Ollama Server</span>
              <StatusIndicator
                label="Ollama"
                state={systemHealth.ollamaStatus}
                detail={
                  systemHealth.ollamaStatus === 'connected'
                    ? `${systemHealth.ollamaModels.length} model(s) loaded`
                    : undefined
                }
              />
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="font-medium">
                Selected Model ({settings.aiModels.ollamaModel})
              </span>
              <StatusIndicator
                label="Model"
                state={
                  systemHealth.ollamaStatus !== 'connected'
                    ? 'disconnected'
                    : systemHealth.selectedOllamaModelInstalled
                      ? 'connected'
                      : 'not_configured'
                }
                detail={
                  systemHealth.ollamaStatus !== 'connected'
                    ? 'Ollama offline'
                    : systemHealth.selectedOllamaModelInstalled
                      ? 'Installed'
                      : 'Not pulled in Ollama'
                }
              />
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="font-medium">Gemini API</span>
              <StatusIndicator label="Gemini" state={systemHealth.geminiStatus} />
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Mic className="w-3.5 h-3.5 text-amber-500" />
                <span>Microphone & Voice Service</span>
              </span>
              <StatusIndicator
                label="Voice"
                state={systemHealth.voiceServiceStatus}
                detail={`Mic: ${systemHealth.microphonePermission}`}
              />
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="font-medium">Screen Vision Capture</span>
              <StatusIndicator
                label="Vision"
                state={systemHealth.screenVisionStatus}
                detail={
                  systemHealth.isElectronDesktop
                    ? 'Electron desktopCapturer'
                    : 'Browser DisplayMedia'
                }
              />
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="font-medium">Local File System Access</span>
              <StatusIndicator label="Files" state={systemHealth.fileSystemStatus} />
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="md" className="lg:col-span-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
            Recent System Events
          </h2>

          {activityLog.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-10 text-center">
              No runtime events recorded in this session yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-amber-900/12 dark:border-white/[0.08] text-stone-500 dark:text-stone-400">
                    <th className="py-2 pr-3 font-medium">Category</th>
                    <th className="py-2 pr-3 font-medium">Event</th>
                    <th className="py-2 text-right font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-900/10 dark:divide-white/[0.05]">
                  {activityLog.slice(0, 7).map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 pr-3 capitalize text-amber-700 dark:text-amber-300 font-medium">
                        {item.category}
                      </td>
                      <td className="py-2.5 pr-3 text-[#171411] dark:text-[#FAF6EE]">
                        {item.title}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-stone-500 dark:text-stone-400">
                        {item.timestamp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
