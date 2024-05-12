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
    <Box sx={{ display: 'flex', flexDirection: 'column'}}>
      <Box sx={{ display: 'flex', flexGrow: 1 }}>
        <AppBar position="fixed">
          <Toolbar sx={{ marginLeft: "240px" }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>toolbar test</Typography>
          </Toolbar>
        </AppBar>
      </Box>
      <Box sx={{ display: 'flex', marginTop: "100px" }}>
        <Drawer
          sx={{
            width: 240,
            marginTop: "200px" ,
            flexShrink: 0,
            '&.MuiDrawer-paper': {
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
        <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3, alignItems: 'center' }}>
          <Outlet />
        </Box>
      </Box>    
    </Box>
  );
}
