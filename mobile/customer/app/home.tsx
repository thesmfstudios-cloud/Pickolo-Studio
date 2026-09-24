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

const HERO = 'data:image/jpeg;base64,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';

const HERO_IMAGE = { uri: HERO };

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