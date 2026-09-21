import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';

const LOGO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCABQASwDASIAAhEBAxEB/8QAHAAAAwACAwEAAAAAAAAAAAAABQYHAgQAAQMI/8QASRAAAQMDAgIFBwgIBAQHAAAAAQIDBAAFEQYSITEHE0FRYRQicYGRobIVMjZzdLHB0RYjJjVCUnKSFzOC4SVDYpNFVFVldbPx/8QAGQEAAwEBAQAAAAAAAAAAAAAAAAECAwQF/8QAJBEAAgICAgMAAgMBAAAAAAAAAAECESExAxIEMkFRYQUTIkL/2gAMAwEAAhEDEQA/AHPVF5Nhsjs9DIeWFJQhJOBknt8KQT0oXTst8L2r/OmjpN+h7n17f31GzW0IpolsfB0oXT/0+F7V/nWbXSjcN/662xVJ7Qhakn8aVoOmr1PiIlQrc88yvO1acYOOHfXlcLFdrW2Hbhb32Gycb1J83PpFV1iK2Vaxa8tN3dRGc3Q5KuCUOkbVHuCvzxTSDXzeTxqzdHt6cvFh6uSsrkw1BtajzUnHmk/d6qicK0NOwRqDpCl229yoMWDHW3HXs3OKVlR7TwrY0nrqTe72i3yoTLYcQopW0o8CBnjmkPWH0tun2hVb3Rx9Mov9Dnw1TgutivJZyaH3i92+yRfKLg+GwfmoHFSz4Cs73cmLNaX58nihpPBI5rV2Aek1CbvdZd4uDkya5ucXyHYgdiR4VEY9ht0Odz6Tpji1JtcNplvsW956j6hwHvoR/iBqXfu8sa9HUpxS0wy7IeSyw2t11XzUISST6hRlWjtR9T1vyQ/t7uGfZnNa9YoVsZLX0nS21JTdobbzfatjzVD1HgfdVBs94gXmKJNvfDqOShyUg9xHZUBfYdjuqZkNLacT85C0kEeo1UujXTci3x3LrMK23JKAltnlhHPcod57P96icUsgmz01brmRZLyqBFhsu9WhKlLcUeJPHgBWpp7pBl3S+RoEqCwhEhWwKbUrKTjhzpZ6SD+2Ur6tv4a09FfTC1/X/gafRdbC8lyBpd1fqtnTkdtDbaX5j3FDRVgBP8x8KJ6gu0axWt2dJOQnghAPFauxIqE3S5SbtcXZsxe5105OOSR2AeAqIxsbwOZ6ULnjhboXtX+dOOjb7Pv9velzobTDYXtaU2Thffz7ql+kdOu6hugaO5MVrCn3B2DuHiapWr7y1pawNsQEIbfcHVRkAcEAc1er7zVSSukCZ6ak1nbrDuj8ZM3H+Sg4Cf6j2ejnU4uWur/PcVtl+StnkiONuPXzoEy1KuE0NtJckSX18BzUtRp9t+h7VbGkOajkqekqGfJmTgJ9J5n3CqUUsfSJTUV2k6Qli9Xbfv8AlSbu7+vV+dFrdru/wXE75XlbQ5ofGc+vnTp5BpQt7PkFAQeG7OD7c0IuuhYM5hb+m31JeQMmI8fneg1TVbRjx+Vw8kusJWxq0zrC3agAZTmPMAyWFnn4pPb99MRNfOo8ogy/+YxIYX/SpCh+NWfReof0htG90gTGCEPgdp7Fev781lKFZOmwfrLWcjT9xahxYjTpU31ilOk44kgAAeihVp6SJsu6xYsmBGDT7qWyWyrcMnGeJoZ0qDGpWPsqfiVSzYuN/t32pr4hVRinGxN5PoGuV2eZrqshnK1LlcYdriKlz30ssp7Vdp7gO016TZbECE9Lkr2MsoK1nwFQ3Ud/laguKpMglLSThlrPBtP595qox7A3Q3XbpOcKyizwkhI5OyOJPoSPxNAl9IGpFK3CY2nwSynFLKG1OLCEJKlKOAlIySfRRpvR+o3WusTaZG3GfOwCfUTmtesVsm2Hrf0mXRlQFwjMSUdpQOrV+Xup+sGpLbf2iqC6Q6kZWy5wWn1do8RUOlQ5MJ4szGHGHRzQ4kg1yFMkQJbcqI6pp5o5Ssdn+1JwT0NM+iK5QbSl+b1DZ0SgAh9B2Ptj+FXh4HnRqshin0nfQ9z69v76jY51ZOk36HufXt/fUaNa8ehMt3R/w0ZAx27/AIjRi7NMPWmW1LALCmVb892OdSaya8uVmtbMBiLEcbazhTgVk5Oew1533XV4vMNURfUx2FjC0spIKx3EknhUuDbHYrCqH0SLV5dcUfwlpBPp3HH41PBVc6LrUuJZHp7ySlUxQKAf5E8j6yTVTf8AkS2T3WB/a26faFUQ6NvplG+rc+Gh+sR+110+0H8KIdG30yjfVufCaH6B9GDpauCt8G2oV5uC+sd55J/Gptgk4AzTj0olX6VjOceTo2++lm17BdIhd+Z16N3o3DNOHqJ7LJo7TbFhtbSlNpM55AU84RxBP8I7gKYzxFcPKuhWDd5LNCfaLdcXmXZ0Np5xhW5Clp4j8x4UQ7K6IrugCL9JX0zlfVt/DQ3SL7UbVFvffcS2027uWtRwAADRLpK+mcn6tv4aVQCTgDNdC9SHsYNY6kd1DcytO5ERnKWGz3fzHxNB7bAk3O4MwoaN7zqsAdg7yfAVrmnvosnW9i5yIz6AmZIADLpPMDmgdx7fGlJdVgFllFsFmjWK0twowztGXF44uK7Sak3SJcFTdVyW85bigMoHdjifeatAVxxUC1FuOo7lv5+VOfEajjVsp6HTo7gN2+ySr+6gKfWS1Hz2DkT6z91Brtc7jcLybda97klxeFLHzlK7QO4DvpstG0dHtp6vluO705VU2gXKVabyJ8YgSGnFHzhkHOcg1vHEG1tnDKK5fJcZ6ilj9v6Z3uBdbPNEe6hwOkBacubgod4NNmkbp5THCW1rTIjnJClZ4dmD3Upagv03UE5MqcUAoTsQhsYSkVv6IC/llak/NDKt3uxSg29mf8jxRfA5LDjlDB0k21p2JFv7CAlTp6qQB2qxwPuI9lB+jm4Kg6qYaz+rlgsrHvHvHvpq1Yc9Hr+//wAyjb/d/wDtT7Tm79JLZsznypv4hUVho6vG5HycUZvbQxdKpzqZn7Mn71Us2E/8ft32pr4hTP0qD9pWvsyfiVSvYvpBbvtTXxCiPqbvZ9CHma6rvtNdVgUIPSvcVs22Jbm1YEhZccx2pTjA9p91S2n3paB+WYHd5MfiNIaMdYnd83Iz6K3hiJD2WHo/02xa7U1PkNAzpKN+5Q4tpPIDu4c6bSMnNYt7erR1eNu0bcd2OFZ1i3bsoG36yQ77blxZaBux+rdx5zau8H8Kg8yK7DmPRXxh1lZQoeINfRJqHa4KDrG5dXy6wZ9O0Zq+P8CYT6MLgqJqTyQq/VTGykj/AKhxB+/21XqhuiQo6wtmzn13uwc1cxRyKmC0KfSd9D3Pr2/vqNGrL0nfQ9z69v76jfbVcegYXg6YvdwholQrc48wvO1YIAOOHaa3GNDaldVg2xSPFbiQPvqldHo/YuF/r+I0yDhUvkaY6JxYejTq3kyL4+haUnPk7RyD/Uru8BVFQEttpQhISlIACQMADurI11iobb2MhWsfpbdPtB/Ct3o4ONZRf6HPhNaOsuGrrp9oP4Vu9HAzrOJ/Q58JrZ+hK2MHSxb1FUG5pGU4LCz3dqfxqcZxyr6EvFsj3a1PwJI/Vupxkc0nsI9BqFXq0TLNcVw5re1aeKVD5q094pQligaK9ovUrF+tjbbjiRPZSEvNk8VY/iHeDTKrhXzg064w4lxpakLScpUk4I9BoudWagLXVfLErbjHzuPt51L4/wAApFouF6ttrcabuExphbytqAo8T4+A8a3/AEV84vPOvul19xbrivnLWoqJ9ZqpdGOoJE6O5apYW4YqApp3nhHLaT93+1JwpWNOxU6Sh+2Un6tv4a0NFgHV9sBGQXsEeo0Q6SjnWUr6tv4a0NFfTC1/Xj7jWi9BfQv0haXFnlifBbxBkK4pA4NL7vQeykxtxbTqXWllC0KCkqBwQRyNfQ9xhMXKC9Dlo3svJ2qH4jxqF6gssixXV2DI47eLa8cFo7DSg+2GDwV3ReoW9Q2oLcUkTWAEvo7z2KHgam/SJb1QNVyF7cNygHkHvzwPvFCrBeZFiurU6Nx28FozwWntBqo6jtkbWummZduWlT6QXI6jw49qD3fmKXpINoA9HdwbuFpk6eeWEvJJdjk9vePUfcaB6m09IanrdZbIKj+tbxxSe8d4pdSqVbZu5JcjyWF+hSFCny3a9t9wZQzqWGetSMCSyOfpHMerNaxl1w9M5uXhk5Lk43Ulj9NCfF0/PkOhCQ0kH+Ir/DnTvYbEICBGjZdfdOVrxjP5AVt/KejEpDvys4ccdu05+GhN31/Hjx1x9NxVNqWMGU8POHoH5+yhzS9UcfJ43k+Q1HlaUf19Meki5tNsxbBGWF+TnrJBH8+OA95PsoZ0cW1U/VDLxT+qhgvKPjySPafdS2y1JuEwNtJcfkvr4AcVLUatWkNPp09aAyvaqU8Qt9Q7+wDwH51nJ1Gj04xUUktIQ+lT6Ss/Zk/eqlixD9oLd9qa+IUy9KZzqdr7Mj7zSe04tp1DraihaFBSVDmCORpwzEb2fRqjg12BwzUEOp78T+95n/cNZfpTfwP3vL/7lZ/1sqx66Vrep+2xLg2nPk6y25/SrGD7R76lpq0aScXqPRaU3dXX9dvacUeagDgH0+NS/Umn5dguSo0hJU0Tll7HBxP594q4P/kT/JSdA6mj3O2M2+S6Ez46Qjao/wCakciO845im8njivnFK1IUFIJSocQQcEUXZ1XqBlrqkXeUE8uKsn2njSlx5wCZYdQX6HYYCpEpYLpB6pnPnOK7vR3moTKkOSpT0l9W5x1ZWs+JOTXcmS/KeU9KecedVzW4oqJ9telvgSbnNbhwmi684cBI+89wqox6oV2NXRdb1StRKmFP6uG2Tn/qVwA9martCNM2JnT9oRDbIW4Tvecx89f5dgovWUnbsoE6psyr9Y3YCHgysqStKlDIyD20hjotuWP3jD/tV+VVOuE4HCkpNaAGactZstjjW5TodU0DuWBgEk5OKJ1iDXdJgd1yuCuEUDJ5qHo9l3S+Sp0a4MIRIXv2uJVlJ7Rwra0poSTY7yi4SprLiW0KCUNpPEkY45p47ayzwpuTqhGJ41p3S0QLxFMa4x0uo5gngpJ7weyt0CuHhypDJndujB0LUq0z0KR2NyBgj/UOfsoOno51EXNpbi4/m64Yqx8zXMYqu7FSJrbOi90qCrtPQlHa3HGSf9R5eyny12qFZ4gi25hLLY4nHEqPeT2miAORWPbScm9hQj6q0LJvt6XcI01loOISlSHEngQMcCK1tPdH0u1XyLPkz2Fojq37W0qyTjhzqgjga4eNPs9Ac7aBau02zqOAlvelmU0ctOkZx3g+Bo8K6IqU6GS3/C65Hlcof9qvypt0XpudpxmU1KmtvtOlKkIbBwk9p49/D2Uyg4Ndk5qnJsSFzU+kbdqAF1YMeYBgPoHE+Ch21PJ/R9f4az1LCJjfYplXH2HjVlxWQAxxpKTQVZB/0ZvxVt+SJmfq6KW3o8vs1weUobhNdqnVZV6kirEpRB4V0k1b5G0KkBNN6WtunkExkF2SoYXIc+cfAdwo6a6Nd9lZ2UJWstGSNQXJqZFltMlLYbUlxJPIkgjHpoEOi644/eUT+1VVHbXORqlJrQqJb/hbcR/4lE/tVWP+F9zJ/eMP+1f5VVTxFY4xR3YUC9MWZVhsTMBbwdWlSlKUkYGSc8K3Ljb4dzhqizmEPNK/hV2HvB7DWyTXWakCcXTowJWpdongJPJqQOX+ofiKCHo41EHMBEUjvDwqxkYrgFV3YUTGB0Xy1qCrlPaaR2pZBUr2nAHvp6slht1iYLdvjhBV89xXFa/SfwoqT2V0OVJyb2ByuVyuUgNS8SHIlmmyWCA6ywtaCRnBAJFLj0u/xNOovfyozJCWEPuxlxkoCkkAkBQOQeNHdSfRq5/ZXPhNBLTptudZbf5fcrhIjqYbWYy3QGz5oIGAMkeGapVQGSNRssahleWSVoiqiMOMtbSo7lAk4AGScc6PR7tbn7Ybk3LaMRIJU6TgJxzz3GhUFlsa7uSw2kFEJkJOPmjJ5eygEgJbhXJakZiR7+HJCQMgNjbkkd2cGikwG2BqG1T3HERZYUttBWUKSpKtveARxHorWseqId2lyY29CXEOqDIAV56AAdxJHDtofc50O5amsKbW+1IfaeU44tlW7Y1t45I5AnHCvCO4XYOqrdHdSJzkh4ts7sLUNg5DnRSAOt6ksr0pMdqe2pa1bEnBCVK7grGCfXWU7UFrt0nyeZLCHQNykhJVsHerA4D00tXW5WuToBqDCcZXJcabaYjII6xLoI/h5gg5417T3EQZ1wlQb1GjzEtJM2JLQCh4hHMZweI4cM0UA6MrbdaQ60tK0LAUlSTkEHkRSpbXNQXWI7LYvDLOJDraGlxEqThKiBk5zR+0SzMs8OV1Hk/WtJV1QGAjhyHhS1pW9WuFZX25twjsrRLfJQtY3Abz2c6SGGLNew/ClruYbiyLestyxu8xJAzuB7iK2IF+tdzfLEOTudCdwQpBQVJ7xkcR6KTLgzJl2W6XkNrZjTJ7LuFN5PUI4byntHbjuouyhqbqC1rd1JHmvMlTrTTEdIJTtwclJOB6abQjlouEp60QHX7p1LjlxcbPWI3l5IUrDY7uA5+FMcO4RJUVcpl4KZbUpK1EY2lPzs57qSIIzZbCf/e1/Eutq8KegXK4WWPkC+qQpgj+EqO133DNFWAxytQWqPHjyFyxskp3MhKFKUsd4SBnFZG92wW5u4GY35I4sIS7nhuJxg93rpclNOQdZKQi4tWxpUJtuK46ylaVJT85IJIAPI1pSIsY2Za2p6Lg1KvLJcKWdiN24BQA4gg+FCSAbkaitPkBneWJ8n6zqwracqV3AYyfVWzDukG4RXJEWQhTbRIcKvNLeOJ3A8vXS7qsPMahs0nytEKOkOtiQtoLQ2sgYyDwGQMA0NubHlFu1BIi3dNykKYaS+lhkITtBzzBIJ25o6pgb951VCfjMItM89eqWynKUlO9BWArBI4j0U3jnSTqO5WeZabS3BfYcUZcdTKGyCW0hQzkfw91N7MyK7OfiNvpVIYALjY5pB5UPQGldZ8iLeLRGZUA3KeWh0FOcgIyPRxr3vr5j2aS6JohFCQfKCjeG+I447aF6nkMxb5YHpDqGmkyHNy1nAHmd9a2r7nAnaRuiIc2O+pLQKg24FEDcO6kloZ43y+IOoIlt+VHorCWi5IcYbO5S+G0cjw7eFHJWorRAkqjypiUuoxvASVBvPLcQMD11pq4a3tn/wAa58SaAQFuRU3iPMvsa3r8qdU+y/GSpS0q5KyTlQIp7EP25K0pUhQUlQBBByCO+lWBLvV88skwroxE8nfW03F6kL+aceeSc8fCjOnI6I9ggsNSFSG0NAIdUnaVJ7OHZwpflq0tchIuCpXyZObKkrcS51LyVDvTnzvxoQB4SJXltqbmS2osh1tZdiJTvDqgBnCuzHP115PaqsTawlVxbyVbThJISc44nHDj30FgSpcy4aSkXAESHGZBUSMFXmjBx4jBrxittno2ux2JypclSuHMhZwaKAZouoLVJniEzMQp9RISMHCyOYSeR9VYzdS2aI4409MHWNKKVoShSigjnkAcBx50LuraG4ul9iUp2S2QnA5eYaxsVxtkO76hRLkMMOmYpRLpCdyNo7Tzxx4eNFfQNu73JResLkCVliXMCVKbOQ4jao49Fa11vSrbZrxIRcUPvtvKbYAZI6lWB5h78c8mg0Fsoh2BwJKGHb045HSRjDZCtvDur3lH9m9Y/a1/cinQBi0yU7LcG7+8/wBa6remQ1lTx2AlKTgbQOdEJepLPDlKiyJiUuIIC/NJS2TyCiBgeutG6HN60z/Wv/66XrdubtFyiT7/AB4JDzwlR3o6VKO4njknKsjlilV5GOdzvFvtiG1zZKUdb/lpAKlL9AHE0N0/dvlPUF36iUX4baGCyAfNSSFbvQcjjQy3iNaNSQfLZQMc2tDUSS8NgJByRx5HGK97JPtyNQ6lntPNpiJSypbo+acBWT48aKwIbTXKwZdbfZQ8ysLbcSFIUORB5Gs6kZ//2Q==';
const HERO = 'data:image/jpeg;base64,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';

type AuthMode = 'landing' | 'login' | 'signup';

function Arrow() {
  return <Text style={styles.arrow}>→</Text>;
}

function FeatureIcon({ type }: { type: 'passport' | 'edit' | 'photographer' | 'frame' }) {
  return (
    <View style={styles.featureIcon}>
      {type === 'passport' && <View style={styles.personIcon}><View style={styles.personHead} /><View style={styles.personBody} /></View>}
      {type === 'edit' && <><View style={styles.editPlay} /><View style={styles.editCut} /></>}
      {type === 'photographer' && <><View style={styles.node} /><View style={[styles.node, styles.node2]} /><View style={[styles.node, styles.node3]} /><View style={styles.nodeLine} /></>}
      {type === 'frame' && <><View style={styles.frameOuter} /><View style={styles.frameInner} /></>}
    </View>
  );
}

function MailIcon() {
  return <View style={styles.mailIcon}><View style={styles.mailLine} /></View>;
}

function PhoneIcon() {
  return <View style={styles.phoneIcon}><View style={styles.phoneScreen} /></View>;
}

function PinIcon() {
  return <View style={styles.pinIcon}><View style={styles.pinDot} /></View>;
}

export default function CustomerAuth() {
  const [mode, setMode] = useState<AuthMode>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitEmailAuth() {
    if (!supabase) {
      Alert.alert('Pickolo', 'Supabase is not configured.');
      return;
    }
    if (!email.trim() || !password) {
      Alert.alert('Pickolo', 'Please enter your email and password.');
      return;
    }
    if (mode === 'signup' && !fullName.trim()) {
      Alert.alert('Pickolo', 'Please enter your full name.');
      return;
    }

    setBusy(true);
    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { full_name: fullName.trim() } },
          });
    setBusy(false);

    if (result.error) {
      Alert.alert(mode === 'login' ? 'Login failed' : 'Account creation failed', result.error.message);
      return;
    }
    if (mode === 'signup' && !result.data.session) {
      Alert.alert('Account created', 'Check your email if confirmation is enabled.');
      return;
    }
    router.replace('/home');
  }

  function continueWith(provider: 'google' | 'phone') {
    Alert.alert(
      provider === 'google' ? 'Google Sign-in' : 'Phone Sign-in',
      provider === 'google'
        ? 'Google authentication UI is ready. Provider connection will be wired next.'
        : 'Phone authentication UI is ready. OTP flow will be wired next.',
    );
  }

  if (mode !== 'landing') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5FAFF" />
        <KeyboardAvoidingView style={styles.authWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.authHeader}>
            <Pressable onPress={() => setMode('landing')} style={styles.backButton}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <Image source={{ uri: LOGO }} style={styles.smallLogo} resizeMode="contain" />
          </View>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
            <Text style={styles.formSubtitle}>{mode === 'login' ? 'Sign in to continue with Pickolo.' : 'Create your Pickolo account in a few seconds.'}</Text>
            {mode === 'signup' && (
              <TextInput style={styles.input} placeholder="Full name" placeholderTextColor="#7B8AA6" value={fullName} onChangeText={setFullName} />
            )}
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#7B8AA6" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#7B8AA6" value={password} onChangeText={setPassword} secureTextEntry />
            <Pressable style={styles.primaryFormButton} onPress={submitEmailAuth} disabled={busy}>
              <Text style={styles.primaryFormText}>{busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}</Text>
              <Arrow />
            </Pressable>
            <Pressable style={styles.formSwitch} onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
              <Text style={styles.formSwitchText}>{mode === 'login' ? 'Don’t have an account?  Create Account' : 'Already have an account?  Login'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5FAFF" />
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.topRow}>
          <View style={styles.topSpacer} />
          <Pressable onPress={() => Alert.alert('Pickolo', 'Guest mode will be available soon.')} hitSlop={12}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        <Image source={{ uri: LOGO }} style={styles.logo} resizeMode="contain" />

        <View style={styles.heroSection}>
          <View style={styles.copyColumn}>
            <Text style={styles.heroLine}>Your</Text>
            <Text style={styles.heroBlue}>Memories</Text>
            <Text style={styles.heroLine}>Our Priority</Text>
            <Text style={styles.heroSub}>Professional photo services at your doorstep in Bhopal.</Text>
            <View style={styles.heroUnderline} />
          </View>

          <View style={styles.heroVisualWrap}>
            <Image source={{ uri: HERO }} style={styles.heroImage} resizeMode="contain" />
            <View style={styles.handNote}>
              <Text style={styles.noteText}>Made for</Text>
              <Text style={styles.noteText}>Real Moments</Text>
              <View style={styles.noteUnderline} />
            </View>
          </View>
        </View>

        <View style={styles.featureRow}>
          <View style={[styles.feature, { backgroundColor: '#DFF0FF' }]}>
            <FeatureIcon type="passport" />
            <Text style={styles.featureLabel}>Passport{'\n'}Photo</Text>
          </View>
          <View style={[styles.feature, { backgroundColor: '#FFE9EF' }]}>
            <FeatureIcon type="edit" />
            <Text style={styles.featureLabel}>Photo{'\n'}Editing</Text>
          </View>
          <View style={[styles.feature, { backgroundColor: '#EEE9FF' }]}>
            <FeatureIcon type="photographer" />
            <Text style={styles.featureLabel}>Hire{'\n'}Photographer</Text>
          </View>
          <View style={[styles.feature, { backgroundColor: '#E1F7ED' }]}>
            <FeatureIcon type="frame" />
            <Text style={styles.featureLabel}>Frames{'\n'}& More</Text>
          </View>
        </View>

        <View style={styles.servingPill}>
          <PinIcon />
          <Text style={styles.servingText}>Serving{'\n'}Bhopal{'\n'}& Nearby</Text>
        </View>

        <View style={styles.loginCard}>
          <Text style={styles.cardTitle}>Welcome to Pickolo</Text>
          <Text style={styles.cardSubtitle}>Login or create an account to continue</Text>

          <Pressable style={styles.primaryButton} onPress={() => setMode('login')}>
            <MailIcon />
            <Text style={styles.buttonText}>Continue with Email</Text>
            <Arrow />
          </Pressable>

          <Pressable style={styles.outlineButton} onPress={() => continueWith('google')}>
            <View style={styles.googleIcon}><Text style={styles.googleG}>G</Text></View>
            <Text style={styles.outlineText}>Continue with Google</Text>
            <Arrow />
          </Pressable>

          <Pressable style={styles.outlineButton} onPress={() => continueWith('phone')}>
            <PhoneIcon />
            <Text style={styles.outlineText}>Continue with Phone</Text>
            <Arrow />
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>

          <View style={styles.createRow}>
            <Text style={styles.createMuted}>Don’t have an account?</Text>
            <Pressable onPress={() => setMode('signup')} hitSlop={8}>
              <Text style={styles.createLink}>Create Account</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bottomArt}>
          <View style={styles.skyline}>
            <View style={styles.dome} />
            <View style={styles.tower} />
            <View style={styles.tower2} />
            <View style={styles.tree} />
            <View style={styles.lowLine} />
          </View>
          <View style={styles.bottomNote}>
            <Text style={styles.bottomNoteText}>Bhopal</Text>
            <Text style={styles.bottomNoteText}>Clicks Better</Text>
            <View style={styles.bottomUnderline} />
          </View>
        </View>

        <View style={styles.homeIndicator} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5FAFF' },
  page: { paddingHorizontal: 26, paddingBottom: 18, backgroundColor: '#F5FAFF' },
  topRow: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topSpacer: { width: 50 },
  skip: { fontSize: 16, color: '#0D4ACC', fontWeight: '500' },
  logo: { width: '78%', height: 88, alignSelf: 'center', marginTop: 2 },
  heroSection: { minHeight: 300, flexDirection: 'row', alignItems: 'center', marginTop: 0 },
  copyColumn: { width: '49%', zIndex: 3, paddingTop: 12 },
  heroLine: { fontSize: 38, lineHeight: 42, fontWeight: '800', color: '#0C1C46' },
  heroBlue: { fontSize: 38, lineHeight: 42, fontWeight: '800', color: '#1967FF' },
  heroSub: { marginTop: 18, width: 220, fontSize: 15, lineHeight: 21, color: '#64749A', fontWeight: '500' },
  heroUnderline: { marginTop: 24, width: 36, height: 5, borderRadius: 5, backgroundColor: '#1967FF' },
  heroVisualWrap: { width: '61%', height: 315, marginLeft: -14, justifyContent: 'center', position: 'relative' },
  heroImage: { width: '100%', height: 290, marginTop: 28 },
  handNote: { position: 'absolute', right: 4, top: 10, transform: [{ rotate: '-7deg' }] },
  noteText: { fontSize: 18, color: '#0D4ACC', fontStyle: 'italic', fontFamily: Platform.select({ ios: 'Snell Roundhand', android: 'serif' }) },
  noteUnderline: { width: 110, height: 2, backgroundColor: '#1967FF', marginTop: 1, marginLeft: 10, transform: [{ rotate: '6deg' }] },
  featureRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingRight: 92 },
  feature: { width: 67, height: 67, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { textAlign: 'center', fontSize: 12, lineHeight: 15, color: '#16254D', marginTop: 6, fontWeight: '600' },
  featureIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  personIcon: { width: 22, height: 22, alignItems: 'center' },
  personHead: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1976D2', marginTop: 2 },
  personBody: { width: 17, height: 10, borderTopLeftRadius: 9, borderTopRightRadius: 9, backgroundColor: '#1976D2', marginTop: 3 },
  editPlay: { width: 21, height: 16, borderWidth: 2, borderColor: '#FF4B67', borderRadius: 5 },
  editCut: { width: 6, height: 10, borderLeftWidth: 2, borderTopWidth: 2, borderColor: '#FF4B67', transform: [{ rotate: '45deg' }], position: 'absolute', left: 9, top: 7 },
  node: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: '#6E58E8', left: 2, top: 9 },
  node2: { left: 15, top: 2 },
  node3: { left: 15, top: 16 },
  nodeLine: { width: 16, height: 12, borderLeftWidth: 2, borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#6E58E8' },
  frameOuter: { width: 22, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#1DAA6F' },
  frameInner: { width: 8, height: 8, borderRadius: 2, borderWidth: 2, borderColor: '#1DAA6F' },
  servingPill: { position: 'absolute', right: 0, top: 397, width: 106, height: 78, backgroundColor: '#FFFFFF', borderTopLeftRadius: 30, borderBottomLeftRadius: 30, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingLeft: 8, shadowColor: '#AAB8CF', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  pinIcon: { width: 22, height: 26, borderWidth: 3, borderColor: '#1B65DC', borderRadius: 12, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, alignItems: 'center', justifyContent: 'flex-start', transform: [{ scale: 0.75 }] },
  pinDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#1B65DC', marginTop: 5 },
  servingText: { marginLeft: 1, color: '#18284F', fontSize: 12, lineHeight: 14, fontWeight: '700' },
  loginCard: { marginTop: 32, borderRadius: 28, backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingTop: 24, paddingBottom: 26, shadowColor: '#AAB8CF', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  cardTitle: { textAlign: 'center', fontSize: 24, lineHeight: 28, fontWeight: '800', color: '#13214B' },
  cardSubtitle: { textAlign: 'center', fontSize: 14, color: '#697A9D', marginTop: 7, marginBottom: 22 },
  primaryButton: { height: 58, borderRadius: 18, backgroundColor: '#1967FF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, justifyContent: 'space-between' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', flex: 1, marginLeft: 16 },
  outlineButton: { height: 58, borderRadius: 18, borderWidth: 1.2, borderColor: '#D6E0F0', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, justifyContent: 'space-between', marginTop: 12 },
  outlineText: { color: '#18284F', fontSize: 16, fontWeight: '600', flex: 1, marginLeft: 17 },
  arrow: { color: '#617699', fontSize: 26, fontWeight: '400', lineHeight: 26 },
  mailIcon: { width: 24, height: 18, borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 4, justifyContent: 'center' },
  mailLine: { width: 13, height: 13, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: '#FFFFFF', transform: [{ rotate: '-45deg' }], alignSelf: 'center', marginTop: -6 },
  phoneIcon: { width: 16, height: 25, borderWidth: 2, borderColor: '#1967FF', borderRadius: 4, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 3 },
  phoneScreen: { width: 8, height: 13, borderRadius: 2, backgroundColor: '#EAF2FF' },
  googleIcon: { width: 20, alignItems: 'center' },
  googleG: { fontSize: 23, fontWeight: '800', color: '#4285F4' },
  orRow: { flexDirection: 'row', alignItems: 'center', marginTop: 23, marginBottom: 18, paddingHorizontal: 8 },
  orLine: { height: 1, backgroundColor: '#B8C7E0', flex: 1 },
  orText: { color: '#7383A1', fontSize: 12, marginHorizontal: 12, fontWeight: '500' },
  createRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  createMuted: { color: '#60749B', fontSize: 13 },
  createLink: { color: '#1967FF', fontSize: 13, fontWeight: '700' },
  bottomArt: { height: 145, position: 'relative', marginTop: 0 },
  skyline: { position: 'absolute', left: -12, right: -12, bottom: 3, height: 90, opacity: 0.24 },
  lowLine: { position: 'absolute', left: 0, right: 0, bottom: 16, height: 2, backgroundColor: '#8CA3C8' },
  dome: { position: 'absolute', left: 36, bottom: 30, width: 46, height: 46, borderRadius: 24, borderWidth: 2, borderColor: '#8CA3C8', borderBottomWidth: 3 },
  tower: { position: 'absolute', left: 105, bottom: 24, width: 12, height: 57, borderWidth: 2, borderColor: '#8CA3C8' },
  tower2: { position: 'absolute', right: 110, bottom: 24, width: 12, height: 57, borderWidth: 2, borderColor: '#8CA3C8' },
  tree: { position: 'absolute', right: 18, bottom: 26, width: 44, height: 50, borderRadius: 22, borderWidth: 2, borderColor: '#8CA3C8' },
  bottomNote: { position: 'absolute', right: 4, bottom: 30, transform: [{ rotate: '-8deg' }] },
  bottomNoteText: { fontSize: 18, color: '#0D4ACC', fontStyle: 'italic', fontFamily: Platform.select({ ios: 'Snell Roundhand', android: 'serif' }) },
  bottomUnderline: { width: 104, height: 2, backgroundColor: '#1967FF', marginTop: 2, marginLeft: 9, transform: [{ rotate: '5deg' }] },
  homeIndicator: { width: 105, height: 5, borderRadius: 4, backgroundColor: '#18284F', alignSelf: 'center', marginTop: -6 },
  authWrap: { flex: 1, padding: 20, justifyContent: 'center' },
  authHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#EAF2FF' },
  backText: { fontSize: 30, lineHeight: 30, color: '#1A2F57' },
  smallLogo: { width: 170, height: 48, marginRight: 52 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 22, shadowColor: '#AAB8CF', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  formTitle: { fontSize: 28, fontWeight: '800', color: '#13214B' },
  formSubtitle: { fontSize: 14, color: '#697A9D', marginTop: 8, marginBottom: 22, lineHeight: 20 },
  input: { height: 54, borderWidth: 1, borderColor: '#D8E2F0', borderRadius: 15, backgroundColor: '#FBFDFF', paddingHorizontal: 16, fontSize: 16, color: '#13214B', marginBottom: 12 },
  primaryFormButton: { height: 56, borderRadius: 16, backgroundColor: '#1967FF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, justifyContent: 'space-between', marginTop: 2 },
  primaryFormText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  formSwitch: { paddingVertical: 16, alignItems: 'center' },
  formSwitchText: { color: '#1F4FB5', fontWeight: '700', fontSize: 13 },
});
