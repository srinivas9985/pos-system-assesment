import React, { memo, useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, type ViewStyle } from 'react-native';

interface Props {
  size?: 'card' | 'detail';
  style?: ViewStyle;
}

function ProductPlaceholderComponent({ size = 'card', style }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const isDetail = size === 'detail';

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={[styles.base, isDetail ? styles.detail : styles.card, style]}>
      <Animated.View style={[styles.skeleton, { opacity: pulse }]}>
        <View style={[styles.iconBox, isDetail && styles.iconBoxDetail]}>
          <View style={[styles.iconMountain, isDetail && styles.iconMountainDetail]} />
          <View style={[styles.iconSun, isDetail && styles.iconSunDetail]} />
        </View>
      </Animated.View>
    </View>
  );
}

export const ProductPlaceholder = memo(ProductPlaceholderComponent);

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#eceff1',
    overflow: 'hidden',
  },
  card: {
    width: 100,
    height: 100,
  },
  detail: {
    width: '100%',
    height: 200,
  },
  skeleton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0e0e0',
  },
  iconBox: {
    width: 44,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#cfd8dc',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  iconBoxDetail: {
    width: 72,
    height: 58,
    borderRadius: 8,
  },
  iconMountain: {
    width: 0,
    height: 0,
    borderLeftWidth: 22,
    borderRightWidth: 22,
    borderBottomWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#b0bec5',
  },
  iconMountainDetail: {
    borderLeftWidth: 36,
    borderRightWidth: 36,
    borderBottomWidth: 28,
  },
  iconSun: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#b0bec5',
  },
  iconSunDetail: {
    top: 8,
    right: 10,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
