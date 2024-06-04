import { Suspense } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
} from '@mui/material';

import { DrawerItem } from './drawer.item';
import { menuItems } from './menus';

export function Sidebar() {
  const navigate = useNavigate();
  const items = menuItems;

  const handleClick = (item: DrawerItem) => {
    navigate({ pathname: item.path });
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        sx={{
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            position: 'relative',
            width: 240,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar />
        <List>
          {items.map((item: DrawerItem) => (
            <ListItem key={item.text} disablePadding onClick={() => handleClick(item)}>
              <ListItemButton>
                <ListItemIcon>
                  <item.icon />
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          height: '100vh',
          overflow: 'auto',
          bgcolor: 'background.default',
          marginLeft: '10px',
          marginTop: '10px'
        }}
      >
        <Toolbar />
        <Suspense fallback={<div>Loading...</div>}>
          <Outlet />
        </Suspense>
      </Box>
    </Box>
  );
}
