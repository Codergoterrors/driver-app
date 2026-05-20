// Custom Drawer Content — Uber Driver sidebar menu
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import { Colors, Spacing } from '../constants';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { logout } from '../store/slices/authSlice';
import { setOnline, clearOrder } from '../store/slices/orderSlice';
import { useTheme } from '../theme/ThemeContext';
import { Switch } from 'react-native';

const DrawerContent: React.FC<any> = (props) => {
  const dispatch = useAppDispatch();
  const rider = useAppSelector(s => s.auth.rider);
  const { theme, colors, toggleTheme } = useTheme();

  const menuItems = [
    { label: 'Inbox', icon: 'email-outline', badge: '10+' },
    { label: 'Refer Friends', icon: 'account-multiple-plus-outline' },
    { label: 'Opportunities', icon: 'lightning-bolt', badge: '10+' },
    { label: 'Earnings', icon: 'cash-multiple', screen: 'Earnings' },
    { label: 'Eats Pro', icon: 'star-circle-outline' },
    { label: 'Wallet', icon: 'wallet-outline' },
    { label: 'Account', icon: 'account-circle-outline' },
  ];

  const handleLogout = async () => {
    dispatch(setOnline(false));
    dispatch(clearOrder());
    dispatch(logout());
    await auth().signOut();
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      {/* Profile header */}
      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          {rider?.profilePhotoUrl ? (
            <Image source={{ uri: rider.profilePhotoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
              <Icon name="account" size={36} color={colors.textSecondary} />
            </View>
          )}
          <View style={styles.greenDot} />
        </View>
      </View>

      {/* Menu items */}
      <View style={styles.menuSection}>
        {menuItems.map((item, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.menuItem}
            onPress={() => {
              if (item.screen) {
                props.navigation.navigate(item.screen);
              }
              props.navigation.closeDrawer();
            }}
            activeOpacity={0.6}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{item.label}</Text>
            {item.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom links */}
      <View style={styles.bottomLinks}>
        <View style={styles.menuItem}>
          <Text style={[styles.menuLabel, { color: colors.textPrimary, fontSize: 16 }]}>Dark Mode</Text>
          <Switch value={theme === 'dark'} onValueChange={toggleTheme} trackColor={{ false: colors.offlineGray, true: colors.goBlue }} />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <TouchableOpacity style={styles.bottomLink}><Text style={[styles.bottomLinkText, { color: colors.textSecondary }]}>Help</Text></TouchableOpacity>
        <TouchableOpacity style={styles.bottomLink}><Text style={[styles.bottomLinkText, { color: colors.textSecondary }]}>Learning Center</Text></TouchableOpacity>
        <TouchableOpacity style={styles.bottomLink} onPress={handleLogout}>
          <Text style={[styles.bottomLinkText, { color: Colors.errorRed }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileSection: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxxl, paddingBottom: Spacing.lg },
  avatarContainer: { position: 'relative', width: 60, height: 60 },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  greenDot: { position: 'absolute', bottom: 2, left: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.onlineGreen, borderWidth: 2, borderColor: Colors.white },
  menuSection: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  menuLabel: { fontSize: 22, fontWeight: '700', flex: 1 },
  badge: { backgroundColor: Colors.goBlue, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  bottomLinks: { paddingHorizontal: Spacing.xl, marginTop: 'auto' },
  divider: { height: 1, marginBottom: Spacing.lg },
  bottomLink: { paddingVertical: Spacing.md },
  bottomLinkText: { fontSize: 14, fontWeight: '500' },
});

export default DrawerContent;
