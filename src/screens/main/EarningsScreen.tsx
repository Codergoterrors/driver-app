// EarningsScreen — Today's earnings summary
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Spacing } from '../../constants';
import { useTheme } from '../../theme/ThemeContext';
import { useAppSelector } from '../../store/hooks';
import { formatCurrency } from '../../utils';

const EarningsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, theme } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, theme), [colors, theme]);
  const { todayEarnings, todayTrips } = useAppSelector(s => s.order);
  const rider = useAppSelector(s => s.auth.rider);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Earnings</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.amountSection}>
        <Text style={styles.amountLabel}>Today</Text>
        <Text style={styles.amountValue}>{formatCurrency(todayEarnings)}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{todayTrips}</Text>
          <Text style={styles.statLabel}>Trips</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatCurrency(rider?.totalEarnings || 0)}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{rider?.totalDeliveries || 0}</Text>
          <Text style={styles.statLabel}>All-time</Text>
        </View>
      </View>

      <View style={styles.ratingCard}>
        <Icon name="star" size={28} color={colors.warningOrange} />
        <View>
          <Text style={styles.ratingValue}>{rider?.rating?.toFixed(1) || '5.0'}</Text>
          <Text style={styles.ratingLabel}>Your Rating</Text>
        </View>
      </View>
    </View>
  );
};

const getStyles = (colors: any, theme: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: (StatusBar.currentHeight || 44) + 8, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  amountSection: { alignItems: 'center', paddingVertical: Spacing.xxxxl },
  amountLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
  amountValue: { fontSize: 48, fontWeight: '800', color: colors.textPrimary },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.xxl },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: Spacing.xl, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  ratingCard: { marginHorizontal: Spacing.lg, backgroundColor: colors.surface, borderRadius: 12, padding: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  ratingValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  ratingLabel: { fontSize: 13, color: colors.textSecondary },
});

export default EarningsScreen;
