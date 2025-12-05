import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  FlatList,
  RefreshControl,
  Modal,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { collection, getDocs, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const { width } = Dimensions.get('window');
type AuthMode = 'login' | 'register' | 'forgot';
type ViewMode = 'profile' | 'mahasiswa';
interface Mahasiswa { id: string; nama: string; nim: string; email: string; jurusan: string; }

const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [nim, setNim] = useState('');
  const [jurusan, setJurusan] = useState('');
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [viewMode, setViewMode] = useState<ViewMode>('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [mahasiswaList, setMahasiswaList] = useState<Mahasiswa[]>([]);
  const [mahasiswaLoading, setMahasiswaLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: boolean}>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;
      if (currentUser) {
        await AsyncStorage.setItem('user_session', JSON.stringify({ uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName }));
        setUser(currentUser);
      } else {
        await AsyncStorage.removeItem('user_session');
        setUser(null);
        setViewMode('profile');
      }
      setLoading(false);
    });
    return () => { isMounted = false; unsubscribe(); };
  }, []);

  const resetForm = () => { setEmail(''); setPassword(''); setConfirmPassword(''); setFullName(''); setNim(''); setJurusan(''); setShowPassword(false); setShowConfirmPassword(false); setFieldErrors({}); };
  const switchMode = (mode: AuthMode) => { resetForm(); setAuthMode(mode); };

  const handleLogin = async () => {
    const errors: {[key: string]: boolean} = {};
    if (!email.trim()) errors.email = true;
    if (!password.trim()) errors.password = true;
    if (Object.keys(errors).length > 0) { 
      setFieldErrors(errors); 
      setTimeout(() => Alert.alert('Peringatan', 'Harap isi Email dan Password!'), 100); 
      return; 
    }
    setFieldErrors({});
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setSuccessMessage('Login berhasil!'); setShowSuccessModal(true);
    } catch (error: any) {
      let msg = 'Terjadi kesalahan';
      if (error.code === 'auth/user-not-found') msg = 'User tidak ditemukan';
      else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') msg = 'Email atau password salah';
      Alert.alert('Login Gagal', msg);
    } finally { setAuthLoading(false); }
  };

  const handleRegister = async () => {
    const errors: {[key: string]: boolean} = {};
    if (!fullName.trim()) errors.fullName = true;
    if (!nim.trim()) errors.nim = true;
    if (!jurusan.trim()) errors.jurusan = true;
    if (!email.trim()) errors.email = true;
    if (!password.trim()) errors.password = true;
    if (!confirmPassword.trim()) errors.confirmPassword = true;
    if (Object.keys(errors).length > 0) { 
      setFieldErrors(errors); 
      setTimeout(() => Alert.alert('Peringatan', 'Harap isi semua field yang diperlukan!'), 100); 
      return; 
    }
    if (password.length < 6) { 
      setTimeout(() => Alert.alert('Error', 'Password minimal 6 karakter!'), 100); 
      return; 
    }
    if (password !== confirmPassword) { 
      setFieldErrors({ confirmPassword: true }); 
      setTimeout(() => Alert.alert('Error', 'Konfirmasi password tidak cocok!'), 100); 
      return; 
    }
    setFieldErrors({});
    setAuthLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: `${fullName}|${nim}|${jurusan}` });
      await setDoc(doc(db, 'mahasiswa', cred.user.uid), { nama: fullName.trim(), nim: nim.trim(), jurusan: jurusan.trim(), email: email.trim() });
      setSuccessMessage('Akun berhasil dibuat!'); setShowSuccessModal(true);
    } catch (error: any) {
      let msg = 'Terjadi kesalahan';
      if (error.code === 'auth/email-already-in-use') msg = 'Email sudah terdaftar';
      Alert.alert('Registrasi Gagal', msg);
    } finally { setAuthLoading(false); }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { Alert.alert('Error', 'Masukkan email!'); return; }
    setAuthLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Berhasil', 'Link reset dikirim ke email.', [{ text: 'OK', onPress: () => switchMode('login') }]);
    } catch { Alert.alert('Gagal', 'Email tidak terdaftar'); }
    finally { setAuthLoading(false); }
  };

  const handleLogout = async () => { await signOut(auth); await AsyncStorage.removeItem('user_session'); resetForm(); setAuthMode('login'); setUser(null); setViewMode('profile'); };

  const fetchMahasiswa = async () => {
    setMahasiswaLoading(true);
    try {
      const q = query(collection(db, 'mahasiswa'), orderBy('nama'));
      const snap = await getDocs(q);
      const data: Mahasiswa[] = [];
      snap.forEach((d) => { const dd = d.data(); data.push({ id: d.id, nama: dd.nama || '', nim: dd.nim || '', email: dd.email || '', jurusan: dd.jurusan || '' }); });
      setMahasiswaList(data);
    } catch { Alert.alert('Error', 'Gagal memuat data'); }
    finally { setMahasiswaLoading(false); setRefreshing(false); }
  };

  const handleViewMahasiswa = () => { setViewMode('mahasiswa'); fetchMahasiswa(); };
  const onRefresh = () => { setRefreshing(true); fetchMahasiswa(); };
  const getUserInfo = () => { if (user?.displayName) { const p = user.displayName.split('|'); return { nama: p[0] || 'User', nim: p[1] || '-', jurusan: p[2] || '-' }; } return { nama: 'User', nim: '-', jurusan: '-' }; };
  const getColors = (n: string): [string, string] => { const c: [string, string][] = [['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140']]; return c[n.charCodeAt(0) % c.length]; };

  const renderMahasiswaItem = ({ item }: { item: Mahasiswa }) => (
    <View style={s.card}>
      <LinearGradient colors={getColors(item.nama)} style={s.cardAvatar}><Text style={s.cardAvatarText}>{item.nama.charAt(0).toUpperCase()}</Text></LinearGradient>
      <View style={s.cardInfo}>
        <Text style={s.cardName}>{item.nama}</Text>
        <Text style={s.cardNim}>{item.nim}</Text>
        <View style={s.cardTagRow}><View style={s.cardTag}><Ionicons name="school" size={10} color="#667eea" /><Text style={s.cardTagText}>{item.jurusan}</Text></View></View>
        <View style={s.cardEmailRow}><Ionicons name="mail" size={11} color="#888" /><Text style={s.cardEmailText}>{item.email}</Text></View>
      </View>
    </View>
  );

  if (loading) return <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={s.center}><StatusBar barStyle="light-content" /><ActivityIndicator size="large" color="#667eea" /><Text style={s.loadingText}>Loading...</Text></LinearGradient>;

  if (user) {
    const info = getUserInfo();
    if (viewMode === 'mahasiswa') {
      return (
        <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={s.container}><StatusBar barStyle="light-content" />
          <View style={s.header}><TouchableOpacity onPress={() => setViewMode('profile')}><LinearGradient colors={['#667eea', '#764ba2']} style={s.backBtn}><Ionicons name="arrow-back" size={20} color="#fff" /></LinearGradient></TouchableOpacity><Text style={s.headerTitle}>Data Mahasiswa</Text><View style={{ width: 44 }} /></View>
          {mahasiswaLoading ? <View style={s.center}><ActivityIndicator size="large" color="#667eea" /></View> : mahasiswaList.length === 0 ? <View style={s.center}><LinearGradient colors={['#667eea', '#764ba2']} style={s.emptyIcon}><Ionicons name="school" size={50} color="#fff" /></LinearGradient><Text style={s.emptyText}>Belum ada data</Text></View> : <FlatList data={mahasiswaList} renderItem={renderMahasiswaItem} keyExtractor={(i) => i.id} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />} />}
        </LinearGradient>
      );
    }
    return (
      <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={s.container}><StatusBar barStyle="light-content" />
        <Modal visible={showSuccessModal} transparent animationType="fade"><View style={s.modalOverlay}><View style={s.modalBox}><LinearGradient colors={['#667eea', '#764ba2']} style={s.modalIcon}><Ionicons name="checkmark" size={40} color="#fff" /></LinearGradient><Text style={s.modalTitle}>Berhasil!</Text><Text style={s.modalMsg}>{successMessage}</Text><TouchableOpacity onPress={() => setShowSuccessModal(false)}><LinearGradient colors={['#667eea', '#764ba2']} style={s.modalBtn}><Text style={s.modalBtnText}>OK</Text></LinearGradient></TouchableOpacity></View></View></Modal>
        <ScrollView contentContainerStyle={s.profileScroll}>
          <Text style={s.profileTitle}>Profil Pengguna</Text><Text style={s.profileSub}>Informasi akun Mahasiswa</Text>
          <View style={s.avatarWrap}><LinearGradient colors={['#667eea', '#764ba2']} style={s.avatar}><Text style={s.avatarText}>{info.nama.charAt(0).toUpperCase()}</Text></LinearGradient><View style={s.online} /></View>
          <Text style={s.profileName}>{info.nama}</Text><View style={s.badge}><Text style={s.badgeText}>Mahasiswa</Text></View>
          <View style={s.infoCard}>
            <View style={s.infoRow}><LinearGradient colors={['#667eea', '#764ba2']} style={s.infoIcon}><Ionicons name="person" size={16} color="#fff" /></LinearGradient><View style={s.infoTextWrap}><Text style={s.infoLabel}>NAMA</Text><Text style={s.infoVal}>{info.nama}</Text></View></View><View style={s.divider} />
            <View style={s.infoRow}><LinearGradient colors={['#f093fb', '#f5576c']} style={s.infoIcon}><Ionicons name="card" size={16} color="#fff" /></LinearGradient><View style={s.infoTextWrap}><Text style={s.infoLabel}>NIM</Text><Text style={s.infoVal}>{info.nim}</Text></View></View><View style={s.divider} />
            <View style={s.infoRow}><LinearGradient colors={['#4facfe', '#00f2fe']} style={s.infoIcon}><Ionicons name="school" size={16} color="#fff" /></LinearGradient><View style={s.infoTextWrap}><Text style={s.infoLabel}>JURUSAN</Text><Text style={s.infoVal}>{info.jurusan}</Text></View></View><View style={s.divider} />
            <View style={s.infoRow}><LinearGradient colors={['#43e97b', '#38f9d7']} style={s.infoIcon}><Ionicons name="mail" size={16} color="#fff" /></LinearGradient><View style={s.infoTextWrap}><Text style={s.infoLabel}>EMAIL</Text><Text style={s.infoVal}>{user.email}</Text></View></View>
          </View>
          <TouchableOpacity onPress={handleViewMahasiswa}><LinearGradient colors={['#667eea', '#764ba2']} style={s.actionBtn}><Ionicons name="people" size={20} color="#fff" /><Text style={s.actionBtnText}>Lihat Semua Data</Text></LinearGradient></TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}><LinearGradient colors={['#f093fb', '#f5576c']} style={s.actionBtn}><Ionicons name="log-out" size={20} color="#fff" /><Text style={s.actionBtnText}>Keluar</Text></LinearGradient></TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={s.container}><StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.authScroll} keyboardShouldPersistTaps="handled">
          <View style={s.authHeader}><View style={s.logoWrap}><LinearGradient colors={['#a855f7', '#6366f1', '#8b5cf6']} style={s.logo}><Ionicons name="school" size={40} color="#fff" /></LinearGradient></View><Text style={s.authTitle}>Portal Informasi Mahasiswa</Text><Text style={s.authSub}>{authMode === 'login' ? 'Selamat datang!' : authMode === 'register' ? 'Buat akun baru' : 'Reset password'}</Text></View>
          <View style={s.form}>
            {authMode === 'register' && <View style={[s.inputWrap, focusedField === 'fullName' && s.inputFocused, fieldErrors.fullName && s.inputError]}><LinearGradient colors={['#667eea', '#764ba2']} style={s.inputIcon}><Ionicons name="person" size={16} color="#fff" /></LinearGradient><TextInput placeholder="Nama Lengkap" placeholderTextColor="#888" value={fullName} onChangeText={(t) => { setFullName(t); setFieldErrors(e => ({...e, fullName: false})); }} onFocus={() => setFocusedField('fullName')} onBlur={() => setFocusedField(null)} style={s.input} /></View>}
            {authMode === 'register' && <View style={[s.inputWrap, focusedField === 'nim' && s.inputFocused, fieldErrors.nim && s.inputError]}><LinearGradient colors={['#667eea', '#764ba2']} style={s.inputIcon}><Ionicons name="card" size={16} color="#fff" /></LinearGradient><TextInput placeholder="NIM" placeholderTextColor="#888" value={nim} onChangeText={(t) => { setNim(t); setFieldErrors(e => ({...e, nim: false})); }} onFocus={() => setFocusedField('nim')} onBlur={() => setFocusedField(null)} style={s.input} keyboardType="numeric" /></View>}
            {authMode === 'register' && <View style={[s.inputWrap, focusedField === 'jurusan' && s.inputFocused, fieldErrors.jurusan && s.inputError]}><LinearGradient colors={['#667eea', '#764ba2']} style={s.inputIcon}><Ionicons name="school" size={16} color="#fff" /></LinearGradient><TextInput placeholder="Jurusan" placeholderTextColor="#888" value={jurusan} onChangeText={(t) => { setJurusan(t); setFieldErrors(e => ({...e, jurusan: false})); }} onFocus={() => setFocusedField('jurusan')} onBlur={() => setFocusedField(null)} style={s.input} /></View>}
            <View style={[s.inputWrap, focusedField === 'email' && s.inputFocused, fieldErrors.email && s.inputError]}><LinearGradient colors={['#667eea', '#764ba2']} style={s.inputIcon}><Ionicons name="mail" size={16} color="#fff" /></LinearGradient><TextInput placeholder="Email" placeholderTextColor="#888" value={email} onChangeText={(t) => { setEmail(t); setFieldErrors(e => ({...e, email: false})); }} onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)} style={s.input} autoCapitalize="none" keyboardType="email-address" /></View>
            {authMode !== 'forgot' && <View style={[s.inputWrap, focusedField === 'password' && s.inputFocused, fieldErrors.password && s.inputError]}><LinearGradient colors={['#667eea', '#764ba2']} style={s.inputIcon}><Ionicons name="lock-closed" size={16} color="#fff" /></LinearGradient><TextInput placeholder="Password" placeholderTextColor="#888" value={password} onChangeText={(t) => { setPassword(t); setFieldErrors(e => ({...e, password: false})); }} onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)} style={s.input} secureTextEntry={!showPassword} /><TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eye}><Ionicons name={showPassword ? 'eye' : 'eye-off'} size={20} color="#888" /></TouchableOpacity></View>}
            {authMode === 'register' && <View style={[s.inputWrap, focusedField === 'confirmPassword' && s.inputFocused, fieldErrors.confirmPassword && s.inputError]}><LinearGradient colors={['#667eea', '#764ba2']} style={s.inputIcon}><Ionicons name="shield-checkmark" size={16} color="#fff" /></LinearGradient><TextInput placeholder="Konfirmasi Password" placeholderTextColor="#888" value={confirmPassword} onChangeText={(t) => { setConfirmPassword(t); setFieldErrors(e => ({...e, confirmPassword: false})); }} onFocus={() => setFocusedField('confirmPassword')} onBlur={() => setFocusedField(null)} style={s.input} secureTextEntry={!showConfirmPassword} /><TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={s.eye}><Ionicons name={showConfirmPassword ? 'eye' : 'eye-off'} size={20} color="#888" /></TouchableOpacity></View>}
            {authMode === 'login' && <TouchableOpacity onPress={() => switchMode('forgot')} style={s.forgot}><Text style={s.forgotText}>Lupa Password?</Text></TouchableOpacity>}
            <TouchableOpacity onPress={authMode === 'login' ? handleLogin : authMode === 'register' ? handleRegister : handleForgotPassword} disabled={authLoading}><LinearGradient colors={['#667eea', '#764ba2']} style={s.submitBtn}>{authLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>{authMode === 'login' ? 'MASUK' : authMode === 'register' ? 'DAFTAR' : 'KIRIM'}</Text>}</LinearGradient></TouchableOpacity>
            <View style={s.switchWrap}>{authMode === 'login' && <TouchableOpacity onPress={() => switchMode('register')}><Text style={s.switchText}>Belum punya akun? <Text style={s.switchBold}>Daftar</Text></Text></TouchableOpacity>}{authMode === 'register' && <TouchableOpacity onPress={() => switchMode('login')}><Text style={s.switchText}>Sudah punya akun? <Text style={s.switchBold}>Masuk</Text></Text></TouchableOpacity>}{authMode === 'forgot' && <TouchableOpacity onPress={() => switchMode('login')}><Text style={s.switchText}>Kembali ke Login</Text></TouchableOpacity>}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 16, fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  emptyIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyText: { color: '#888', fontSize: 16 },
  card: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardAvatar: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardAvatarText: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: 'bold', color: '#fff' },
  cardNim: { fontSize: 14, color: '#888', marginTop: 2 },
  cardTagRow: { flexDirection: 'row', marginTop: 8 },
  cardTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(102,126,234,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  cardTagText: { fontSize: 12, color: '#667eea', marginLeft: 4, fontWeight: '600' },
  cardEmailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  cardEmailText: { fontSize: 12, color: '#888', marginLeft: 6 },
  profileScroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  profileTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  profileSub: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 4, marginBottom: 32 },
  avatarWrap: { alignItems: 'center', marginBottom: 16 },
  avatar: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 48, fontWeight: 'bold', color: '#fff' },
  online: { position: 'absolute', bottom: 8, right: width / 2 - 60, width: 24, height: 24, borderRadius: 12, backgroundColor: '#43e97b', borderWidth: 4, borderColor: '#24243e' },
  profileName: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  badge: { alignSelf: 'center', backgroundColor: 'rgba(102,126,234,0.2)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: 8, marginBottom: 32 },
  badgeText: { color: '#667eea', fontSize: 14, fontWeight: '600' },
  infoCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  infoIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  infoTextWrap: { marginLeft: 16, flex: 1 },
  infoLabel: { fontSize: 11, color: '#888', letterSpacing: 1 },
  infoVal: { fontSize: 16, color: '#fff', fontWeight: '600', marginTop: 4 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginLeft: 56 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 16, marginBottom: 12 },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  modalBox: { backgroundColor: '#1a1a2e', borderRadius: 24, padding: 32, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  modalMsg: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 24 },
  modalBtn: { paddingHorizontal: 48, paddingVertical: 14, borderRadius: 12 },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  authScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  authHeader: { alignItems: 'center', marginBottom: 32 },
  logoWrap: { borderRadius: 28, marginBottom: 20, shadowColor: '#a855f7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 20 },
  logo: { width: 80, height: 80, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  authTitle: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 8, textAlign: 'center' },
  authSub: { fontSize: 16, color: '#888', textAlign: 'center' },
  form: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, marginBottom: 16, paddingHorizontal: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  inputFocused: { borderColor: '#667eea', borderWidth: 2, backgroundColor: 'rgba(102,126,234,0.1)' },
  inputError: { borderColor: '#f5576c', borderWidth: 2, backgroundColor: 'rgba(245,87,108,0.1)' },
  inputIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', margin: 6 },
  input: { flex: 1, paddingVertical: 16, paddingHorizontal: 12, fontSize: 16, color: '#fff' },
  eye: { padding: 12 },
  forgot: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { color: '#667eea', fontSize: 14, fontWeight: '600' },
  submitBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  switchWrap: { marginTop: 24, alignItems: 'center' },
  switchText: { color: '#888', fontSize: 15 },
  switchBold: { color: '#667eea', fontWeight: 'bold' },
});

export default AuthScreen;