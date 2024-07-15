import { dashMenu } from '../dashboard/menu';
import { nsMenu } from '../resource_namespace/menu';
import { serviceMenu } from '../resource_service/menu';
import { deploymentMenu } from '../resource_deployment/menu';
import { DrawerItem } from './drawer.item';
import { podMenu } from '../resource_pod/menu';

export const menuItems: DrawerItem[] = [
  ...dashMenu,
  ...nsMenu,
  ...serviceMenu,
  ...deploymentMenu,
  ...podMenu,
];
