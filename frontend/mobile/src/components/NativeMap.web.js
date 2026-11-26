import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function NativeMap({ pickup, drop }) {
  const point = drop || pickup;
  const openMaps = () => {
    if (!point) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lon}`;
    Linking.openURL(url).catch(() => Alert.alert('Unable to open map', 'No compatible maps app is available.'));
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Trip locations</Text>
      {pickup?.address ? <Text style={styles.address}>●  {pickup.address}</Text> : null}
      {drop?.address ? <Text style={styles.address}>●  {drop.address}</Text> : null}
      {point ? (
        <Pressable accessibilityRole="link" onPress={openMaps}>
          <Text style={styles.link}>Open in Maps</Text>
        </Pressable>
      ) : (
        <Text style={styles.address}>Location details will appear here.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 140, justifyContent: 'center', gap: 10, padding: 18, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.foreground, fontWeight: '800', fontSize: 16 },
  address: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  link: { color: colors.green, fontWeight: '800', fontSize: 14 },
});
