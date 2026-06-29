import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function GymCard({ gym, onPress }) {
  const isDemo = gym?.source === 'demo';
  const hasContact = gym?.phone !== 'Não informado' || !!gym?.website;

  const name = gym?.name || 'Academia sem nome';
  const address = gym?.address || 'Endereço não informado';
  const distance = Number(gym?.distanceKm || 0);
  const price = Number(gym?.monthlyPrice || 0);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.address}>{address}</Text>

          {isDemo ? (
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>Resultado demonstrativo</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.priceBadge}>
          <Text style={styles.priceBadgeLabel}>Preço estimado</Text>
          <Text style={styles.priceBadgeValue}>R$ {price.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoPill}>
          <Text style={styles.infoPillText}>{distance.toFixed(2)} km</Text>
        </View>

        <View style={[styles.infoPill, hasContact ? styles.contactPill : styles.mutedPill]}>
          <Text style={[styles.infoPillText, hasContact ? styles.contactText : styles.mutedText]}>
            {hasContact ? 'Contato disponível' : 'Sem contato'}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.openText}>Toque para ver detalhes, contato e rota</Text>
        <Text style={styles.arrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 5,
  },
  address: {
    color: '#4b5563',
    lineHeight: 19,
    fontSize: 13,
  },
  demoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
    marginTop: 9,
  },
  demoBadgeText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '900',
  },
  priceBadge: {
    minWidth: 104,
    backgroundColor: '#ecfdf5',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
  },
  priceBadgeLabel: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
    textAlign: 'center',
  },
  priceBadgeValue: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '900',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  infoPill: {
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  contactPill: {
    backgroundColor: '#f0fdf4',
  },
  mutedPill: {
    backgroundColor: '#f3f4f6',
  },
  infoPillText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '800',
  },
  contactText: {
    color: '#15803d',
  },
  mutedText: {
    color: '#6b7280',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  openText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
  },
  arrowText: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '900',
  },
});