export interface MenuItemProps {
  icon: string;
  label: string;
  goto: string;
  isActive?: boolean;
  onClick: () => void;
}

export interface SidebarProps {
  items: MenuItemProps[];
}
