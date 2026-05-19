// EarningsScreen — Today's earnings summary
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing } from '../../constants';
import { useAppSelector } from '../../store/hooks';
import { formatCurrency } from '../../utils';

const EarningsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { todayEarnings, todayTrips } = useAppSelector(s => s.order);
  const rider = useAppSelector(s => s.auth.rider);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={Colors.black} />
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
        <Icon name="star" size={28} color={Colors.warningOrange} />
        <View>
          <Text style={styles.ratingValue}>{rider?.rating?.toFixed(1) || '5.0'}</Text>
          <Text style={styles.ratingLabel}>Your Rating</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: (StatusBar.currentHeight || 44) + 8, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  title: { fontSize: 20, fontWeight: '700', color: Colors.black },
  amountSection: { alignItems: 'center', paddingVertical: Spacing.xxxxl },
  amountLabel: { fontSize: 14, color: Colors.textSecondary, marginBottom: 4 },
  amountValue: { fontSize: 48, fontWeight: '800', color: Colors.black },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.xxl },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, paddingVertical: Spacing.xl, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: Colors.black },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  ratingCard: { marginHorizontal: Spacing.lg, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  ratingValue: { fontSize: 22, fontWeight: '800', color: Colors.black },
  ratingLabel: { fontSize: 13, color: Colors.textSecondary },
});

export default EarningsScreen;
