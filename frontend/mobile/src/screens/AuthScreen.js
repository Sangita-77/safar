import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { colors } from '../theme';

function ClerkAuthCard({ signUp, router }) {
  const { startHostedAuth } = useHostedAuth();
  const [busy, setBusy] = useState(false);

  const begin = async (targetMode) => {
    setBusy(true);
    try {
      await startHostedAuth({ mode: targetMode });
    } catch (error) {
      Alert.alert('Sign-in unavailable', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.logo}><Text style={styles.logoText}>S</Text></View>
      <Text style={styles.title}>{signUp ? 'Create your Safar account' : 'Welcome back'}</Text>
      <Text style={styles.copy}>Sign in to book a ride, send a parcel, or manage your driver account.</Text>
      {busy ? <ActivityIndicator size="large" color={colors.green} /> : (
        <>
          <Pressable accessibilityRole="button" onPress={() => begin(signUp ? 'sign-up' : 'sign-in')} style={styles.primary}>
            <Text style={styles.primaryText}>{signUp ? 'Create account' : 'Continue to sign in'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => begin(signUp ? 'sign-in' : 'sign-up')} style={styles.secondary}>
            <Text style={styles.secondaryText}>{signUp ? 'I already have an account' : 'Create an account'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.back}>
            <Text style={styles.secondaryText}>Back</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function CredentialsAuthCard({ signUp: initialSignUp, initialIntent, router }) {
  const { signInWithCredentials, registerWithCredentials } = useApp();
  const [signUp, setSignUp] = useState(initialSignUp);
  const [accountType, setAccountType] = useState(initialIntent === 'driver' ? 'driver' : 'customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [busy, setBusy] = useState(false);

  const switchMode = () => {
    setSignUp((prev) => !prev);
    setErrorText('');
  };

  const handleSubmit = async () => {
    setErrorText('');
    const cleanEmail = email.trim().toLowerCase();
    if (signUp && name.trim().length < 2) {
      setErrorText('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorText('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorText('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      if (signUp) {
        const res = await registerWithCredentials({
          name: name.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          password,
        });
        if (accountType === 'driver' && res?.user?.role !== 'admin') {
          router.replace('/driver-apply');
          return;
        }
      } else {
        await signInWithCredentials({
          email: cleanEmail,
          password,
        });
      }
      router.replace('/');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollWrap} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.logo}><Text style={styles.logoText}>S</Text></View>
          <View>
            <Text style={styles.brandTag}>SAFAR MOBILITY</Text>
            <Text style={styles.title}>{signUp ? 'Create your account' : 'Welcome back'}</Text>
          </View>
        </View>
        <Text style={styles.copy}>
          {signUp
            ? 'Register with your email and password to book rides or apply as a driver partner.'
            : 'Sign in with your registered email and password.'}
        </Text>

        {!!errorText && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{errorText}</Text>
          </View>
        )}

        {signUp && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>I want to</Text>
            <View style={styles.intentRow}>
              {[
                ['customer', '🚕 Book rides & parcels'],
                ['driver', '🚘 Drive & earn'],
              ].map(([id, label]) => (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: accountType === id }}
                  onPress={() => setAccountType(id)}
                  style={[styles.intentBtn, accountType === id && styles.intentBtnActive]}
                >
                  <Text style={[styles.intentText, accountType === id && styles.intentTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {signUp && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Full name</Text>
            <TextInput
              accessibilityLabel="Full name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              placeholderTextColor="#87928D"
              autoCapitalize="words"
              style={styles.input}
            />
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email address</Text>
          <TextInput
            accessibilityLabel="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#87928D"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        {signUp && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Mobile number</Text>
            <TextInput
              accessibilityLabel="Mobile number"
              value={phone}
              onChangeText={setPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor="#87928D"
              keyboardType="phone-pad"
              maxLength={15}
              style={styles.input}
            />
          </View>
        )}

        <View style={styles.fieldGroup}>
          <View style={styles.passwordLabelRow}>
            <Text style={styles.fieldLabel}>Password</Text>
            <Pressable onPress={() => setShowPassword((v) => !v)} accessibilityRole="button">
              <Text style={styles.togglePassword}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={signUp ? 'Create a password (min. 6 characters)' : 'Enter your password'}
            placeholderTextColor="#87928D"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            onSubmitEditing={handleSubmit}
            style={styles.input}
          />
        </View>

        {busy ? <ActivityIndicator size="large" color={colors.green} style={{ marginVertical: 10 }} /> : (
          <>
            <Pressable accessibilityRole="button" onPress={handleSubmit} style={styles.primary}>
              <Text style={styles.primaryText}>
                {signUp
                  ? accountType === 'driver'
                    ? 'Continue to driver application →'
                    : 'Create account'
                  : 'Sign in'}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={switchMode} style={styles.secondary}>
              <Text style={styles.secondaryText}>
                {signUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.back}>
              <Text style={styles.backText}>‹ Back to Home</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

export default function AuthScreen() {
  const { mode, intent } = useLocalSearchParams();
  const router = useRouter();
  const { authMode } = useApp();
  const signUp = mode === 'sign-up';

  return (
    <View style={styles.screen}>
      {authMode === 'clerk' ? (
        <ClerkAuthCard signUp={signUp} router={router} />
      ) : (
        <CredentialsAuthCard signUp={signUp} initialIntent={intent} router={router} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.background },
  scrollWrap: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
  card: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    gap: 15,
    padding: 26,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.brand },
  logoText: { color: colors.foreground, fontSize: 27, fontWeight: '900' },
  brandTag: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.foreground, fontSize: 25, fontWeight: '900' },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 13,
    padding: 12,
  },
  errorText: { color: '#991B1B', fontSize: 13, fontWeight: '600', lineHeight: 19 },
  fieldGroup: { gap: 6 },
  intentRow: { flexDirection: 'row', gap: 8 },
  intentBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F6F7F2',
    alignItems: 'center',
  },
  intentBtnActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  intentText: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  intentTextActive: { color: colors.white },
  passwordLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  togglePassword: { color: colors.green, fontSize: 12, fontWeight: '800' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    color: colors.foreground,
    fontSize: 15,
  },
  primary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.foreground, marginTop: 4 },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  secondary: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.secondary },
  secondaryText: { color: colors.foreground, fontWeight: '700', fontSize: 14 },
  back: { alignItems: 'center', padding: 6 },
  backText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
});
