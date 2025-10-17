import { Image } from 'expo-image';
import { Platform, StyleSheet, Linking } from 'react-native';

import { Collapsible } from '@/components/ui/collapsible';
import { ExternalLink } from '@/components/external-link';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

export default function MorgengrauenScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#1A1A1A', dark: '#0D0D0D' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#FFFFFF"
          name="music.note"
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText
          type="title"
          style={{
            fontFamily: Fonts.rounded,
            color: '#FFFFFF',
          }}>
          Morgengrauen
        </ThemedText>
      </ThemedView>

      <ThemedText style={styles.description}>
        Official site of Morgengrauen – darkwave, gothic, and ambient music.
      </ThemedText>

      <Collapsible title="Meet the Band">
      <ThemedText style={styles.collapsibleText}>
        Morgengrauen is a death-metal / DSBM band from Fusch an der Glocknerstrasse, Austria.
        Founded in 2006 by multi-instrumentalist and vocalist Chris Harms, the band has released
        several albums and EPs, gaining a dedicated following in the gothic and darkwave scenes.
      </ThemedText>

      {/* Band Members */}
      <ThemedView style={styles.membersContainer}>
        {/* Member 1 */}
        <ThemedView style={styles.memberCard}>
          <Image
            source={require('./ChrisHarms.jpg')}
            style={styles.memberImage}
          />
          <ThemedText style={styles.memberName}>Chris Harms</ThemedText>
          <ThemedText style={styles.memberRole}>Vocals / Guitar</ThemedText>
        </ThemedView>

        {/* Member 2 */}
        <ThemedView style={styles.memberCard}>
          <Image
            source={require('./Jonas.png')}
            style={styles.memberImage}
          />
          <ThemedText style={styles.memberName}>Der Beobachter</ThemedText>
          <ThemedText style={styles.memberRole}>Guitar / Backing Vocals</ThemedText>
        </ThemedView>

        {/* Member 3 */}
        <ThemedView style={styles.memberCard}>
          <Image
            source={require('./Lukas.png')}
            style={styles.memberImage}
          />
          <ThemedText style={styles.memberName}>Lukas Schwarz</ThemedText>
          <ThemedText style={styles.memberRole}>Drums / Percussion</ThemedText>
        </ThemedView>
      </ThemedView>
    </Collapsible>


      <Collapsible title="Upcoming Shows">
        <ThemedText style={styles.collapsibleText}>
          Catch Morgengrauen live! Tour dates and locations are updated regularly.
        </ThemedText>
        <ExternalLink href="https://www.morgengrauen.com/shows">
          <ThemedText type="link">View full tour schedule</ThemedText>
        </ExternalLink>
      </Collapsible>

      <Collapsible title="Listen Online">
        <ThemedText style={styles.collapsibleText}>
          Stream our music on your favorite platforms:
        </ThemedText>
        <ThemedText
          style={styles.link}
          onPress={() => Linking.openURL('https://open.spotify.com/')}>
          Spotify
        </ThemedText>
        <ThemedText
          style={styles.link}
          onPress={() => Linking.openURL('https://music.apple.com/')}>
          Apple Music
        </ThemedText>
        <ThemedText
          style={styles.link}
          onPress={() => Linking.openURL('https://bandcamp.com/')}>
          Bandcamp
        </ThemedText>
      </Collapsible>

      <Collapsible title="Social Media">
        <ThemedText style={styles.collapsibleText}>
          Follow Morgengrauen for updates, behind-the-scenes content, and more.
        </ThemedText>
        <ThemedText
          style={styles.link}
          onPress={() => Linking.openURL('https://instagram.com/morgengrauen.band')}>
          Instagram
        </ThemedText>
        <ThemedText
          style={styles.link}
          onPress={() => Linking.openURL('https://facebook.com/morgengrauen')}>
          Facebook
        </ThemedText>
        <ThemedText
          style={styles.link}
          onPress={() => Linking.openURL('https://twitter.com/morgengrauen')}>
          Twitter
        </ThemedText>
      </Collapsible>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({

  collapsibleText: {
    color: '#CCCCCC',
    marginBottom: 10,
  },
  membersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  memberCard: {
    alignItems: 'center',
    width: 100,
  },
  memberImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 5,
  },
  memberName: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  memberRole: {
    fontSize: 12,
    color: '#AAAAAA',
    textAlign: 'center',
  },
  headerImage: {
    color: '#FFFFFF',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  description: {
    marginBottom: 20,
    color: '#FFFFFF',
  },
  link: {
    color: '#1DB954', // Spotify green, adjust as needed
    marginVertical: 3,
    textDecorationLine: 'underline',
  },
});
