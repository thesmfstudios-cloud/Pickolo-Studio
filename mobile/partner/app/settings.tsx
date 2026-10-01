import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Header, Page, SectionTitle, ui } from '../ui/components';
import { colors } from '../ui/theme';
export default function Settings() { const [jobs, setJobs] = useState(true); const [updates, setUpdates] = useState(true); return <Page><Header title="Settings" subtitle="Control your partner experience" back /><SectionTitle>Notifications</SectionTitle><Card><Toggle label="New job alerts" value={jobs} setValue={setJobs} /><Toggle label="Booking updates" value={updates} setValue={setUpdates} /></Card><SectionTitle>App</SectionTitle><Card><Menu label="Language · English" /><Menu label="Privacy policy" onPress={() => router.push('/about')} /><Menu label="Terms for partners" onPress={() => router.push('/about')} /><Menu label="About Pickolo" onPress={() => router.push('/about')} /></Card></Page>; }
function Toggle({ label, value, setValue }: { label: string; value: boolean; setValue: (v: boolean) => void }) { return <View style={styles.row}><Text style={ui.label}>{label}</Text><Switch value={value} onValueChange={setValue} trackColor={{ true: colors.greenSoft }} thumbColor={value ? colors.green : '#98A2B3'} /></View>; }
function Menu({ label, onPress }: { label: string; onPress?: () => void }) { return <Pressable style={styles.row} onPress={onPress}><Text style={ui.label}>{label}</Text><Text style={styles.chev}>›</Text></Pressable>; }
const styles = StyleSheet.create({ row: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line }, chev: { color: colors.muted, fontSize: 25 } });
