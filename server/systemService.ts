import si from 'systeminformation';
import os from 'node:os';

export interface DriveInfo {
  fs: string;
  mount: string;
  type: string;
  sizeBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
}

export interface RealSystemMetrics {
  collectedAt: string;
  hostname: string;
  platform: string;
  osDistro: string;
  uptimeSeconds: number;
  cpu: {
    available: boolean;
    usagePercent: number | null;
    model: string;
    cores: number;
    physicalCores: number | null;
    speedGhz: number | null;
    error?: string;
  };
  ram: {
    available: boolean;
    totalBytes: number | null;
    usedBytes: number | null;
    availableBytes: number | null;
    usagePercent: number | null;
    error?: string;
  };
  storage: {
    available: boolean;
    totalBytes: number | null;
    usedBytes: number | null;
    freeBytes: number | null;
    usagePercent: number | null;
    drives: DriveInfo[];
    error?: string;
  };
  battery: {
    available: boolean;
    hasBattery: boolean;
    percent: number | null;
    isCharging: boolean | null;
    acConnected: boolean | null;
    timeRemainingMinutes: number | null;
    error?: string;
  };
  network: {
    available: boolean;
    online: boolean;
    interfaces: Array<{
      iface: string;
      type: string;
      ip4: string;
      operstate: string;
      internal: boolean;
    }>;
    error?: string;
  };
}

export async function getRealSystemMetrics(): Promise<RealSystemMetrics> {
  const [loadRes, cpuRes, memRes, fsRes, batRes, netRes, osRes] =
    await Promise.allSettled([
      si.currentLoad(),
      si.cpu(),
      si.mem(),
      si.fsSize(),
      si.battery(),
      si.networkInterfaces(),
      si.osInfo(),
    ]);

  const cpuInfo = cpuRes.status === 'fulfilled' ? cpuRes.value : null;
  const loadInfo = loadRes.status === 'fulfilled' ? loadRes.value : null;
  const memInfo = memRes.status === 'fulfilled' ? memRes.value : null;
  const fsList = fsRes.status === 'fulfilled' ? fsRes.value : null;
  const batInfo = batRes.status === 'fulfilled' ? batRes.value : null;
  const netListRaw = netRes.status === 'fulfilled' ? netRes.value : null;
  const osInfo = osRes.status === 'fulfilled' ? osRes.value : null;

  const cpuUsage =
    loadInfo && typeof loadInfo.currentLoad === 'number'
      ? Number(loadInfo.currentLoad.toFixed(1))
      : null;

  // RAM: `active` reflects OS-used RAM excluding reclaimable page cache, `available` reflects free+reclaimable
  const ramTotal = memInfo?.total ?? null;
  const ramAvailable = memInfo?.available ?? null;
  const ramUsed =
    ramTotal !== null && ramAvailable !== null
      ? Math.max(0, ramTotal - ramAvailable)
      : memInfo?.used ?? null;
  const ramPercent =
    ramTotal && ramUsed !== null
      ? Number(((ramUsed / ramTotal) * 100).toFixed(1))
      : null;

  // Storage: deduplicate mounts by mountpoint and ignore zero-byte virtual mounts
  const seenMounts = new Set<string>();
  const drives: DriveInfo[] = [];
  if (Array.isArray(fsList)) {
    for (const d of fsList) {
      if (!d.size || d.size <= 0) continue;
      if (d.mount && seenMounts.has(d.mount)) continue;
      if (d.mount) seenMounts.add(d.mount);
      const usedBytes = typeof d.used === 'number' ? d.used : 0;
      const freeBytes =
        typeof d.available === 'number'
          ? d.available
          : Math.max(0, d.size - usedBytes);
      const usedPercent =
        typeof d.use === 'number'
          ? Number(d.use.toFixed(1))
          : Number(((usedBytes / d.size) * 100).toFixed(1));
      drives.push({
        fs: d.fs || d.mount,
        mount: d.mount || d.fs,
        type: d.type || 'Unknown',
        sizeBytes: d.size,
        usedBytes,
        freeBytes,
        usedPercent,
      });
    }
  }

  const totalStorage = drives.reduce((acc, d) => acc + d.sizeBytes, 0);
  const usedStorage = drives.reduce((acc, d) => acc + d.usedBytes, 0);
  const freeStorage = drives.reduce((acc, d) => acc + d.freeBytes, 0);
  const storagePercent =
    totalStorage > 0 ? Number(((usedStorage / totalStorage) * 100).toFixed(1)) : null;

  const netInterfaces = Array.isArray(netListRaw)
    ? netListRaw
        .filter((n) => !n.internal)
        .map((n) => ({
          iface: n.iface,
          type: n.type || 'network',
          ip4: n.ip4 || '',
          operstate: n.operstate || 'unknown',
          internal: Boolean(n.internal),
        }))
    : [];

  const isOnline = netInterfaces.some(
    (n) => n.operstate === 'up' && Boolean(n.ip4)
  );

  return {
    collectedAt: new Date().toISOString(),
    hostname: os.hostname(),
    platform: os.platform(),
    osDistro: osInfo ? `${osInfo.distro} ${osInfo.release}`.trim() : os.type(),
    uptimeSeconds: os.uptime(),
    cpu: {
      available: cpuUsage !== null,
      usagePercent: cpuUsage,
      model: cpuInfo
        ? `${cpuInfo.manufacturer} ${cpuInfo.brand}`.trim()
        : os.cpus()[0]?.model || 'Unavailable',
      cores: cpuInfo?.cores ?? os.cpus().length,
      physicalCores: cpuInfo?.physicalCores ?? null,
      speedGhz: cpuInfo?.speed ?? null,
      error: loadRes.status === 'rejected' ? 'CPU sensor unavailable' : undefined,
    },
    ram: {
      available: ramTotal !== null && ramUsed !== null,
      totalBytes: ramTotal,
      usedBytes: ramUsed,
      availableBytes: ramAvailable,
      usagePercent: ramPercent,
      error: memRes.status === 'rejected' ? 'Memory sensor unavailable' : undefined,
    },
    storage: {
      available: drives.length > 0,
      totalBytes: drives.length > 0 ? totalStorage : null,
      usedBytes: drives.length > 0 ? usedStorage : null,
      freeBytes: drives.length > 0 ? freeStorage : null,
      usagePercent: storagePercent,
      drives,
      error:
        fsRes.status === 'rejected'
          ? 'Storage sensor unavailable'
          : drives.length === 0
            ? 'No mounted drives reported'
            : undefined,
    },
    battery: {
      available: batRes.status === 'fulfilled',
      hasBattery: Boolean(batInfo?.hasBattery),
      percent:
        batInfo?.hasBattery && typeof batInfo.percent === 'number'
          ? batInfo.percent
          : null,
      isCharging: batInfo?.hasBattery ? Boolean(batInfo.isCharging) : null,
      acConnected: batInfo?.hasBattery ? Boolean(batInfo.acConnected) : null,
      timeRemainingMinutes:
        batInfo?.hasBattery && typeof batInfo.timeRemaining === 'number'
          ? batInfo.timeRemaining
          : null,
      error: batRes.status === 'rejected' ? 'Battery sensor unavailable' : undefined,
    },
    network: {
      available: netRes.status === 'fulfilled',
      online: isOnline,
      interfaces: netInterfaces,
      error: netRes.status === 'rejected' ? 'Network interface query failed' : undefined,
    },
  };
}
