import React, { memo, useState } from 'react';
import { Image, View, StyleSheet, type ViewStyle } from 'react-native';
import { ProductPlaceholder } from '@/components/ProductPlaceholder';

function productImageUrl(productId: number, size: 'card' | 'detail'): string {
  return size === 'detail'
    ? `https://picsum.photos/seed/${productId}/600/300`
    : `https://picsum.photos/seed/${productId}/300/200`;
}

interface Props {
  productId: number;
  size?: 'card' | 'detail';
  style?: ViewStyle;
}

function ProductImageComponent({ productId, size = 'card', style }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const frameStyle = size === 'detail' ? styles.detailFrame : styles.cardFrame;
  const uri = productImageUrl(productId, size);

  if (failed) {
    return <ProductPlaceholder size={size} style={style} />;
  }

  return (
    <View style={[frameStyle, style]}>
      {!loaded && (
        <View style={styles.placeholderLayer} pointerEvents="none">
          <ProductPlaceholder size={size} />
        </View>
      )}
      <Image
        source={{ uri }}
        style={[frameStyle, loaded ? styles.visible : styles.hidden]}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

export const ProductImage = memo(ProductImageComponent);

const styles = StyleSheet.create({
  cardFrame: {
    width: 100,
    height: 100,
    backgroundColor: '#e0e0e0',
  },
  detailFrame: {
    width: '100%',
    height: 200,
    backgroundColor: '#e0e0e0',
  },
  placeholderLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  visible: {
    opacity: 1,
  },
  hidden: {
    opacity: 0,
  },
});
