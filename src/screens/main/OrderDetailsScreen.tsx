// OrderDetailsScreen — items list, Not Ready/Ready buttons, Report Issue -> opens cancel modal
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Spacing } from '../../constants';
import { useTheme } from '../../theme/ThemeContext';
import { useAppSelector } from '../../store/hooks';
import { formatCustomerName, shortOrderId } from '../../utils';
import firestore from '@react-native-firebase/firestore';

const OrderDetailsScreen: React.FC<{ navigation: any; route: any }> = ({ navigation }) => {
  const { colors, theme } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, theme), [colors, theme]);
  const order = useAppSelector(s => s.order.activeOrder);
  const [notReadyPressed, setNotReadyPressed] = useState(order?.orderNotReady || false);
  const [loading, setLoading] = useState(false);

  if (!order) return null;

  const handleOrderNotReady = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await firestore().collection('orders').doc(order.orderId).update({
        orderNotReady: true, updatedAt: Date.now(),
      });
      setNotReadyPressed(true);
    } finally {
      setLoading(false);
    }
  }, [order, loading]);

  const handleOrderReady = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await firestore().collection('orders').doc(order.orderId).update({
        orderNotReady: false, updatedAt: Date.now(),
      });
      setNotReadyPressed(false);
    } finally {
      setLoading(false);
    }
  }, [order, loading]);

  const handleReportIssue = () => {
    // Navigate back to ActiveOrderScreen and open the cancel/report modal
    navigation.goBack();
    // Pass a param that ActiveOrderScreen reads to auto-open the report modal
    // We use setParams via navigate with merge
    setTimeout(() => {
      navigation.navigate('ActiveOrder', { openReportIssue: true });
    }, 200);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Icon name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Customer info */}
        <View style={styles.customerSection}>
          <View style={styles.customerLeft}>
            <Text style={styles.customerName}>{formatCustomerName(order.customerName || 'Customer')}</Text>
            <Text style={styles.orderCode}>{shortOrderId(order.orderId)}</Text>
          </View>
          <TouchableOpacity style={styles.chatBtn}>
            <Icon name="message-text" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Items list */}
        <View style={styles.itemsList}>
          <Text style={styles.sectionLabel}>Items</Text>
          {order.items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemQtyBadge}>
                <Text style={styles.itemQtyText}>{item.quantity}</Text>
              </View>
              <Text style={styles.itemName}>{item.name}</Text>
            </View>
          ))}
        </View>

        {/* Order status */}
        <View style={styles.statusSection}>
          <Text style={styles.statusLabel}>Order status</Text>
          <View style={styles.statusRow}>
            <Icon name="clock-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.statusValue}>
              {order.status === 'PREPARING' ? 'Not ready' : order.status === 'PICKED_UP' ? 'Picked up' : order.status}
            </Text>
          </View>
        </View>

        {/* Order Not Ready button */}
        <TouchableOpacity
          style={[
            styles.notReadyBtn,
            { backgroundColor: notReadyPressed
              ? (theme === 'dark' ? '#0A2A0A' : '#E8F8EE')
              : (theme === 'dark' ? '#2A2100' : '#FFF8E1') }
          ]}
          onPress={notReadyPressed ? handleOrderReady : handleOrderNotReady}
          activeOpacity={0.7}
          disabled={loading}
        >
          <Icon
            name={notReadyPressed ? 'check-circle-outline' : 'clock-alert-outline'}
            size={22}
            color={notReadyPressed ? colors.onlineGreen : colors.warningOrange}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.notReadyTitle, { color: notReadyPressed ? colors.onlineGreen : colors.warningOrange }]}>
              {notReadyPressed ? 'Order Ready' : 'Order not ready'}
            </Text>
            <Text style={styles.notReadySubtitle}>
              {notReadyPressed
                ? 'Tap to mark order as not ready again'
                : 'Tap to notify customer the order is not ready'}
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Report Issue button */}
        <TouchableOpacity style={styles.reportRow} activeOpacity={0.7} onPress={handleReportIssue}>
          <View style={styles.reportIconWrap}>
            <Icon name="alert-outline" size={20} color={colors.warningOrange} />
          </View>
          <Text style={styles.reportText}>Report an issue</Text>
          <Icon name="chevron-right" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const getStyles = (colors: any, theme: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: (StatusBar.currentHeight || 44) + 8,
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: Spacing.xl },
  customerSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xl },
  customerLeft: {},
  customerName: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  orderCode: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  chatBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemsList: { marginBottom: Spacing.xl },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  itemQtyBadge: { width: 28, height: 28, borderRadius: 6, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  itemQtyText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  itemName: { fontSize: 16, fontWeight: '500', color: colors.textPrimary, flex: 1 },
  statusSection: { backgroundColor: colors.surface, borderRadius: 12, padding: Spacing.lg, marginBottom: Spacing.lg },
  statusLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusValue: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  notReadyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: Spacing.lg, marginBottom: Spacing.md,
  },
  notReadyTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  notReadySubtitle: { fontSize: 12, color: colors.textSecondary },
  reportRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 12, padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  reportIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme === 'dark' ? '#2A1800' : '#FFF3E0', justifyContent: 'center', alignItems: 'center' },
  reportText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flex: 1 },
});

export default OrderDetailsScreen;
