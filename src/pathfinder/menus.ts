import { dashMenu } from '../dashboard/menu';
import { nsMenu } from '../resource_namespace/menu';
import { serviceMenu } from '../resource_service/menu';
import { deploymentMenu } from '../resource_deployment/menu';
import { podMenu } from '../resource_pod/menu';
import { ingressMenu } from '../resource_ingress/menu';
import { DrawerItem } from './drawer.item';

export const menuItems: DrawerItem[] = [
  ...dashMenu,
  ...nsMenu,
  ...serviceMenu,
  ...deploymentMenu,
  ...podMenu,
  ...ingressMenu,
];
