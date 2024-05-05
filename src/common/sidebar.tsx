import { Outlet, useNavigate } from 'react-router';
import {
  Box,
  CssBaseline,
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
    <div>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
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
        <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3 }}>
          <Toolbar />
          <Outlet />
        </Box>
      </Box>
    </div>
  );
}
