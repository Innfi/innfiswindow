import { Outlet, useNavigate } from 'react-router';
import {
  AppBar,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
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
          width: 240,
          flexShrink: 0,
          '&.MuiDrawer-paper': {
            width: 240,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <List>
          <ListItemButton>
            <ListItemText  />
          </ListItemButton>
        </List>
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
      <Box sx={{ display: 'flex', flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>toolbar test</Typography>
        </Toolbar>
      </AppBar>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
