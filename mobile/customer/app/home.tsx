import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../shared/supabase';

const PAPER = '#FBF9F5';
const INK = '#0B1617';
const MUTED = '#5E686D';
const GREEN = '#173F37';
const CARD = '#F4F0EA';

const HERO_IMAGE = require('../assets/photographer-hero.jpg');

function FeatureIcon({ type }: { type: 'bolt' | 'shield' | 'pin' }) {
  return (
    <View style={styles.featureIcon}>
      {type === 'bolt' && <Text style={styles.iconGlyph}>ϟ</Text>}
      {type === 'shield' && (
        <View style={styles.shield}>
          <Text style={styles.shieldCheck}>✓</Text>
        </View>
      )}
      {type === 'pin' && (
        <View style={styles.pin}>
          <View style={styles.pinDot} />
        </View>
      )}
    </View>
  );
}

function HomeIcon({ active }: { active?: boolean }) {
  return (
    <View style={[styles.homeIcon, active && styles.homeIconActive]}>
      <View style={styles.homeRoof} />
      <View style={styles.homeBody}>
        <View style={styles.homeDoor} />
      </View>
    </View>
  );
}

function ProfileIcon({ active }: { active?: boolean }) {
  return (
    <View style={styles.profileIcon}>
      <View style={[styles.profileHead, active && styles.profileActive]} />
      <View style={[styles.profileShoulders, active && styles.profileActive]} />
    </View>
  );
}

export default function CustomerHome() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('Bhopal');

  const compact = width < 380;
  const horizontal = Math.max(24, Math.min(48, width * 0.055));
  const heroHeight = Math.min(
    height * 0.54,
    Math.max(compact ? 430 : 470, width * 1.25),
  );
  const titleSize = compact ? 45 : 52;
  const quoteCardHeight = compact ? 170 : 190;
  const bottomBarHeight = 86 + insets.bottom;

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setName(data.user?.user_metadata?.full_name || '');
    });
  }, []);

  const greeting = useMemo(() => {
    if (!name) return '';
    return name.split(' ')[0];
  }, [name]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.screen}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingHorizontal: horizontal,
              paddingBottom: bottomBarHeight + 28,
            },
          ]}
          showsVerticalScrollIndicator={false}
          bounces
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>Pickolo</Text>
              <Text style={styles.tagline}>P H O T O G R A P H E R S  O N  D E M A N D</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change location"
              hitSlop={10}
              onPress={() => {
                Alert.alert(
                  'Service location',
                  'Pickolo is currently available in Bhopal.',
                );
              }}
              style={styles.locationButton}
            >
              <View style={styles.locationPin}>
                <View style={styles.locationPinDot} />
              </View>
              <Text style={styles.locationText}>{location}</Text>
              <Text style={styles.chevron}>⌄</Text>
            </Pressable>
          </View>

          <View style={[styles.hero, { height: heroHeight }]}>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroTitle, { fontSize: titleSize }]}>
                Book a
              </Text>
              <Text style={[styles.heroTitle, styles.heroTitleStrong, { fontSize: titleSize }]}>
                Photographer
              </Text>
              <Text style={[styles.heroTitle, { fontSize: titleSize }]}>
                Near You
              </Text>

              <Text style={styles.heroSubtitle}>
                For every moment{'\n'}that matters.
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/booking')}
                style={({ pressed }) => [
                  styles.bookButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.bookButtonText}>Book Now</Text>
                <Text style={styles.bookButtonArrow}>→</Text>
              </Pressable>
            </View>

            <Image
              source={HERO_IMAGE}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
              style={[
                styles.heroImage,
                {
                  width: Math.min(width * 0.60, 315),
                  height: heroHeight + 26,
                },
              ]}
            />
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featureItem}>
              <FeatureIcon type="bolt" />
              <Text style={styles.featureText}>
                Quick{'\n'}Booking
              </Text>
            </View>

            <View style={styles.featureItem}>
              <FeatureIcon type="shield" />
              <Text style={styles.featureText}>
                Verified{'\n'}Photographers
              </Text>
            </View>

            <View style={styles.featureItem}>
              <FeatureIcon type="pin" />
              <Text style={styles.featureText}>
                Available{'\n'}in Bhopal
              </Text>
            </View>
          </View>

          <View style={[styles.quoteCard, { minHeight: quoteCardHeight }]}>
            <Text style={styles.quoteMark}>“</Text>

            <View style={styles.quoteCopy}>
              <Text style={styles.quoteText}>
                Let’s capture{'\n'}your story.
              </Text>
              <View style={styles.quoteRule} />
            </View>

            <Text style={styles.quoteSide}>
              P H O T O S{'\n'}T H A T{'\n'}S T A Y{'\n'}F O R E V E R
            </Text>
          </View>

          {greeting ? <Text style={styles.hiddenGreeting}>Welcome, {greeting}</Text> : null}
        </ScrollView>

        <SafeAreaView
          edges={['bottom', 'left', 'right']}
          style={styles.bottomSafe}
        >
          <View style={styles.bottomBar}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: true }}
              style={styles.navItem}
              onPress={() => router.replace('/home')}
            >
              <HomeIcon active />
              <Text style={styles.navLabelActive}>Home</Text>
            </Pressable>

            <Pressable
              accessibilityRole="tab"
              onPress={() => Alert.alert('Profile', 'Profile details will be available here.')}
              style={styles.navItem}
            >
              <ProfileIcon />
              <Text style={styles.navLabel}>Profile</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PAPER,
  },
  screen: {
    flex: 1,
    backgroundColor: PAPER,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: 12,
  },

  header: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brand: {
    color: '#050A0C',
    fontSize: 47,
    lineHeight: 50,
    fontWeight: '900',
    letterSpacing: -2.8,
  },
  tagline: {
    marginTop: 3,
    color: INK,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 3.2,
  },

  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingLeft: 4,
  },
  locationPin: {
    width: 21,
    height: 27,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginRight: 7,
  },
  locationPinDot: {
    width: 17,
    height: 22,
    borderRadius: 9,
    backgroundColor: INK,
    marginTop: 1,
  },
  locationText: {
    color: '#101416',
    fontSize: 21,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  chevron: {
    marginLeft: 6,
    marginTop: -5,
    fontSize: 25,
    lineHeight: 26,
    color: INK,
  },

  hero: {
    position: 'relative',
    marginTop: 46,
    marginHorizontal: -12,
    overflow: 'hidden',
  },
  heroCopy: {
    zIndex: 2,
    position: 'absolute',
    left: 0,
    top: 92,
    width: '67%',
    paddingLeft: 8,
  },
  heroTitle: {
    color: '#091517',
    fontWeight: '300',
    lineHeight: 0.98 * 52,
    letterSpacing: -2.2,
  },
  heroTitleStrong: {
    color: GREEN,
    fontWeight: '900',
    letterSpacing: -2.8,
  },
  heroSubtitle: {
    marginTop: 28,
    color: MUTED,
    fontSize: 21,
    lineHeight: 31,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  bookButton: {
    marginTop: 27,
    width: 245,
    height: 62,
    borderRadius: 32,
    paddingHorizontal: 27,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookButtonText: {
    color: '#F8FBF9',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  bookButtonArrow: {
    color: '#F8FBF9',
    fontSize: 30,
    lineHeight: 31,
    fontWeight: '300',
  },
  heroImage: {
    position: 'absolute',
    right: -7,
    top: 0,
  },

  featureRow: {
    marginTop: -4,
    paddingTop: 5,
    paddingHorizontal: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featureItem: {
    width: '31.5%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    width: 37,
    height: 42,
    marginRight: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    color: '#173E3B',
    fontSize: 39,
    lineHeight: 42,
    fontWeight: '300',
  },
  shield: {
    width: 28,
    height: 31,
    borderWidth: 2.2,
    borderColor: '#173E3B',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '0deg' }],
  },
  shieldCheck: {
    color: '#173E3B',
    fontSize: 17,
    lineHeight: 19,
    fontWeight: '900',
  },
  pin: {
    width: 28,
    height: 34,
    borderWidth: 2.2,
    borderColor: '#173E3B',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  pinDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: '#173E3B',
  },
  featureText: {
    color: '#263438',
    fontSize: 15.5,
    lineHeight: 21,
    fontWeight: '500',
    letterSpacing: -0.15,
  },

  quoteCard: {
    marginTop: 50,
    borderRadius: 25,
    backgroundColor: CARD,
    paddingHorizontal: 28,
    paddingVertical: 25,
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
    overflow: 'hidden',
  },
  quoteMark: {
    color: '#A6AAA6',
    position: 'absolute',
    left: 26,
    top: 6,
    fontSize: 64,
    lineHeight: 70,
    fontWeight: '800',
  },
  quoteCopy: {
    flex: 1,
    paddingTop: 52,
    paddingRight: 10,
  },
  quoteText: {
    color: '#14342F',
    fontSize: 29,
    lineHeight: 39,
    fontWeight: '300',
    letterSpacing: -1,
  },
  quoteRule: {
    marginTop: 19,
    width: 83,
    height: 2,
    backgroundColor: '#5D746D',
  },
  quoteSide: {
    width: 105,
    marginTop: 58,
    color: '#526166',
    fontSize: 11,
    lineHeight: 19,
    letterSpacing: 3.2,
    fontWeight: '600',
    textAlign: 'left',
  },

  hiddenGreeting: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },

  bottomSafe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -5 },
    elevation: 18,
  },
  bottomBar: {
    height: 86,
    backgroundColor: '#FFFEFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 55,
  },
  navItem: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabelActive: {
    marginTop: 8,
    color: '#173F37',
    fontSize: 17,
    fontWeight: '700',
  },
  navLabel: {
    marginTop: 8,
    color: '#7B8389',
    fontSize: 17,
    fontWeight: '500',
  },

  homeIcon: {
    width: 32,
    height: 28,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  homeIconActive: {
    transform: [{ scale: 1.03 }],
  },
  homeRoof: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderRightWidth: 16,
    borderBottomWidth: 15,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#173F37',
  },
  homeBody: {
    width: 22,
    height: 19,
    backgroundColor: '#173F37',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  homeDoor: {
    width: 5,
    height: 10,
    backgroundColor: '#FFFEFC',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },

  profileIcon: {
    width: 32,
    height: 31,
    alignItems: 'center',
  },
  profileHead: {
    width: 15,
    height: 15,
    borderWidth: 2.6,
    borderColor: '#717B81',
    borderRadius: 8,
  },
  profileShoulders: {
    marginTop: 5,
    width: 29,
    height: 14,
    borderWidth: 2.6,
    borderColor: '#717B81',
    borderBottomWidth: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  profileActive: {
    borderColor: '#173F37',
  },

  pressed: {
    opacity: 0.83,
    transform: [{ scale: 0.985 }],
  },
});