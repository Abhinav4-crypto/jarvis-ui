import {
  Activity,
  Eye,
  FolderSearch,
  Globe,
  Home,
  MessageSquare,
  Mic,
  Settings,
} from 'lucide-react';
import type { PageId } from '../../types/jarvis';

export interface NavItemConfig {
  id: PageId;
  label: string;
  shortLabel: string;
  icon: typeof Home;
}

export const PRIMARY_NAV_ITEMS: NavItemConfig[] = [
  { id: 'home', label: 'Home', shortLabel: 'Home', icon: Home },
  { id: 'chat', label: 'AI Chat', shortLabel: 'Chat', icon: MessageSquare },
  { id: 'voice', label: 'Voice Assistant', shortLabel: 'Voice', icon: Mic },
  { id: 'files', label: 'My Files', shortLabel: 'Files', icon: FolderSearch },
  { id: 'vision', label: 'Vision', shortLabel: 'Vision', icon: Eye },
  { id: 'search', label: 'Web Search', shortLabel: 'Search', icon: Globe },
  { id: 'monitor', label: 'System Monitor', shortLabel: 'Monitor', icon: Activity },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
];

export const PAGE_TITLES: Record<PageId, string> = {
  home: 'Home Dashboard',
  chat: 'AI Chat',
  voice: 'Voice Assistant',
  files: 'My Files',
  vision: 'Vision Studio',
  search: 'Web Search',
  monitor: 'System Monitor',
  settings: 'Settings',
  profile: 'User Profile',
  activity: 'Activity History',
};
