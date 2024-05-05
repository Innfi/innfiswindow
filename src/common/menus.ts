import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import DnsIcon from '@mui/icons-material/Dns';
import LeakAddIcon from '@mui/icons-material/LeakAdd';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';

import { DrawerItem } from './drawer.item';

export const menuItems: DrawerItem[] = [
  { text: 'Dashboard', path: '/dashboard', icon: AutoGraphIcon },
  { text: 'Namespaces', path: '/namespaces', icon: DnsIcon },
  { text: 'Services', path: '/services', icon: LeakAddIcon },
  { text: 'Deployments', path: '/deployments', icon: PrecisionManufacturingIcon },
];
