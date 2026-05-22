// PreferencesScreen — Service preferences (matches Uber screenshots)
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Spacing } from '../../constants';
import { useTheme } from '../../theme/ThemeContext';

const PreferencesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, theme } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, theme), [colors, theme]);
  const [selectedServices, setSelectedServices] = useState<string[]>(['delivery']);

  const toggleService = (svc: string) => {
    setSelectedServices(prev =>
      prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc],
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Preferences</Text>
      </View>

      <View style={styles.openBanner}>
        <Text style={styles.openBannerText}>Open to all trips</Text>
      </View>

      <Text style={styles.sectionTitle}>Services</Text>

      <View style={styles.servicesGrid}>
        <TouchableOpacity
          style={[styles.serviceCard, selectedServices.includes('delivery') && styles.serviceCardSelected]}
          onPress={() => toggleService('delivery')} activeOpacity={0.7}>
          {selectedServices.includes('delivery') && (
            <Icon name="check" size={20} color={colors.textPrimary} style={styles.checkIcon} />
          )}
          <Icon name="moped" size={36} color={colors.textPrimary} />
          <Text style={styles.serviceLabel}>Delivery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.serviceCard, selectedServices.includes('connect') && styles.serviceCardSelected]}
          onPress={() => toggleService('connect')} activeOpacity={0.7}>
          {selectedServices.includes('connect') && (
            <Icon name="checkbox-marked" size={20} color={colors.textPrimary} style={styles.checkIcon} />
          )}
          <Icon name="package-variant-closed" size={36} color={colors.textPrimary} />
          <Text style={styles.serviceLabel}>Connect</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.resetBtn} activeOpacity={0.7}
        onPress={() => setSelectedServices(['delivery'])}>
        <Text style={styles.resetText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (colors: any, theme: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingTop: (StatusBar.currentHeight || 44) + 8, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  backBtn: {},
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  openBanner: { backgroundColor: theme === 'dark' ? '#1B2C1C' : '#E8F5E9', marginHorizontal: Spacing.lg, borderRadius: 8, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, marginBottom: Spacing.xxl },
  openBannerText: { fontSize: 14, color: colors.textSecondary },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  servicesGrid: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.md },
  serviceCard: { flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: 12, paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg, alignItems: 'center', gap: Spacing.sm, position: 'relative' },
  serviceCardSelected: { borderColor: colors.textPrimary },
  checkIcon: { position: 'absolute', top: 10, right: 10 },
  serviceLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  resetBtn: { alignSelf: 'center', marginTop: Spacing.xxxl, backgroundColor: colors.surface, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24 },
  resetText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
});

export default PreferencesScreen;
