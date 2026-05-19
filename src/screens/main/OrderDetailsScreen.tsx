// OrderDetailsScreen — Shows items list, order status, report issue
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing } from '../../constants';
import { useAppSelector } from '../../store/hooks';
import { formatCustomerName, shortOrderId } from '../../utils';

const OrderDetailsScreen: React.FC<{ navigation: any; route: any }> = ({ navigation }) => {
  const order = useAppSelector(s => s.order.activeOrder);
  if (!order) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Icon name="close" size={24} color={Colors.black} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Customer info */}
        <View style={styles.customerSection}>
          <View style={styles.customerLeft}>
            <Text style={styles.customerName}>{formatCustomerName(order.customerName || 'Customer')}</Text>
            <Text style={styles.orderCode}>{shortOrderId(order.orderId)}</Text>
          </View>
          <TouchableOpacity style={styles.chatBtn}>
            <Icon name="message-text" size={20} color={Colors.black} />
          </TouchableOpacity>
        </View>

        {/* Items list */}
        <View style={styles.itemsList}>
          {order.items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.quantity > 1 && <Text style={styles.itemQty}>x{item.quantity}</Text>}
            </View>
          ))}
        </View>

        {/* Order status */}
        <View style={styles.statusSection}>
          <Text style={styles.statusLabel}>Order status</Text>
          <View style={styles.statusRow}>
            <Icon name="clock-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.statusValue}>
              {order.status === 'PREPARING' ? 'Not ready' : order.status === 'PICKED_UP' ? 'Picked up' : order.status}
            </Text>
          </View>
        </View>

        {/* Report issue */}
        <TouchableOpacity style={styles.reportRow} activeOpacity={0.7}>
          <Icon name="alert-outline" size={22} color={Colors.warningOrange} />
          <Text style={styles.reportText}>Report issue</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  header: { paddingTop: (StatusBar.currentHeight || 44) + 8, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: Spacing.xl },
  customerSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  customerLeft: {},
  customerName: { fontSize: 24, fontWeight: '800', color: Colors.white },
  orderCode: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  chatBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  itemsList: { marginBottom: Spacing.xl },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  itemName: { fontSize: 16, fontWeight: '600', color: Colors.white, flex: 1 },
  itemQty: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginLeft: 8 },
  statusSection: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: Spacing.lg, marginBottom: Spacing.lg },
  statusLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: Spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusValue: { fontSize: 15, fontWeight: '600', color: Colors.white },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: Spacing.lg },
  reportText: { fontSize: 15, fontWeight: '500', color: Colors.white },
});

export default OrderDetailsScreen;
