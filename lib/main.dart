import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'firebase_options.dart'; 
import 'dart:convert';

// ====== OPTIONAL: set your server endpoint here ======
const String kServerRegisterUrl = 'https://api-go537uh5jq-uc.a.run.app/api/users/signup';

// Top-level background handler (Android/iOS).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  // Do minimal background work if needed (e.g., logging).
  await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
    alert: true,
    badge: true,
    sound: true,
  );
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Qualtrics Portal',
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.deepPurple,
        brightness: Brightness.light,
      ),
      home: const SignUpPage(),
    );
  }
}

class SignUpPage extends StatefulWidget {
  const SignUpPage({super.key});
  @override
  State<SignUpPage> createState() => _SignUpPageState();
}
class RegistrationSuccessPage extends StatelessWidget {
  const RegistrationSuccessPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      //appBar: AppBar(title: const Text('Registration')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.check_circle, color: Colors.green, size: 64),
            SizedBox(height: 24),
            Text(
              'Register successful!',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 12),
            Text(
              'You can close the app.',
              style: TextStyle(fontSize: 16),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignUpPageState extends State<SignUpPage> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _emailCtrl = TextEditingController();

  static const _kNameKey = 'name';
  static const _kEmailKey = 'email';
  static const _kFcmTokenKey = 'fcm_token';

  String _token = '';
  bool _initializing = true;
  StreamSubscription<String>? _tokenRefreshSub;

  @override
  void initState() {
    super.initState();
    _initLoad();
  }

  @override
  void dispose() {
    _tokenRefreshSub?.cancel();
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _initLoad() async {
    // Prefill saved values
    //final prefs = await SharedPreferences.getInstance();
    //_nameCtrl.text = prefs.getString(_kNameKey) ?? '';
    //_emailCtrl.text = prefs.getString(_kEmailKey) ?? '';
   // final savedToken = prefs.getString(_kFcmTokenKey) ?? '';
    //setState(() => _token = savedToken);

    // Foreground handlers (optional)
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      // In foreground, Android/iOS won't show system banner by default.
      // For now, just show a snack as a heads-up that something arrived.
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Push received (foreground).')),
        );
      }
    });

    // Token refresh listener
    _tokenRefreshSub = FirebaseMessaging.instance.onTokenRefresh.listen((t) async {
      await _saveToken(t);
      if (mounted) setState(() => _token = t);
    });

    setState(() => _initializing = false);
  }

  String? _validateName(String? value) {
    final v = (value ?? '').trim();
    if (v.isEmpty) return 'Please enter your name';
    if (v.length < 2) return 'Name should be at least 2 characters';
    return null;
  }

  String? _validateEmail(String? value) {
    final v = (value ?? '').trim().toLowerCase();
    if (v.isEmpty) return 'Please enter your email';
    final emailOk = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v);
    if (!emailOk) return 'Please enter a valid email address';

    // Only allow specific domains
    final allowedDomains = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'mta.ac.il',
    ];
    final domain = v.split('@').last;
    if (!allowedDomains.contains(domain)) {
      return 'Only Gmail, Yahoo, Hotmail, or mta.ac.il emails are allowed';
    }
    return null;
  }

  Future<void> _saveBasics(String name, String email) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kNameKey, name);
    await prefs.setString(_kEmailKey, email);
  }

  Future<void> _saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kFcmTokenKey, token);
  }

  Future<void> _requestPermissionAndGetToken() async {
    try {
      // 1) Request user permission (iOS & Android 13+)
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true, badge: true, sound: true,
        announcement: false, carPlay: false, criticalAlert: false,
        provisional: false,
      );

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        _showSnack('Notifications permission denied.');
        return;
      }

      // 2) Get FCM token (APNs token must exist on iOS real device)
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) {
        _showSnack('Could not obtain FCM token. Try again.');
        return;
      }

      await _saveToken(token);
      if (!mounted) return;
      setState(() => _token = token);
      _showSnack('FCM token retrieved.');
    } catch (e) {
      _showSnack('Error getting token: $e');
    }
  }

  Future<void> _submitAndSendToServer() async {
  FocusScope.of(context).unfocus();
  final valid = _formKey.currentState?.validate() ?? false;
  if (!valid) return;

  final name = _nameCtrl.text.trim();
  final email = _emailCtrl.text.trim();

  await _saveBasics(name, email);

  if (_token.isEmpty) {
    _showSnack('Please enable notifications and get your token first.');
    return;
  }

  if (kServerRegisterUrl.isEmpty) {
    _showSnack('Saved locally. Set kServerRegisterUrl to POST to your server.');
    return;
  }

  try {
    _showSnack('Submitting to server...');
    final resp = await http.post(
      Uri.parse(kServerRegisterUrl),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        "username": name,
        "email": email,
        "fcmToken": _token,
      }),
    );

    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const RegistrationSuccessPage()),
      );
    } else {
      _showSnack('Server error: ${resp.statusCode} ${resp.reasonPhrase}');
    }
  } catch (e) {
    _showSnack('Network error: $e');
  }
}

  void _copyToken() {
    if (_token.isEmpty) {
      _showSnack('No token yet.');
      return;
    }
    Clipboard.setData(ClipboardData(text: _token));
    _showSnack('Token copied to clipboard.');
  }

  void _showSnack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_initializing) {
      return Scaffold(
        //appBar: AppBar(title: const Text('Qualtrics Portal')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      //appBar: AppBar(title: const Text('Qualtrics Portal')),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF6A1B9A), Color(0xFF8E24AA), Color(0xFFAB47BC)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        alignment: Alignment.center,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Card(
              elevation: 10,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
              ),
              child: Padding(
                padding: const EdgeInsets.all(22),
                child: Form(
                  key: _formKey,
                  autovalidateMode: AutovalidateMode.onUserInteraction,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.notifications_active,
                          size: 48, color: theme.colorScheme.primary),
                      const SizedBox(height: 12),
                      Text(
                        'Sign up',
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Enter your name and Email registered for Qualtrics.\nAllow notifications to get your device token.',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 24),
                      TextFormField(
                        controller: _nameCtrl,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Name',
                          hintText: 'yourname',
                          filled: true,
                        ),
                        validator: _validateName,
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _emailCtrl,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.done,
                        decoration: const InputDecoration(
                          labelText: 'Email',
                          hintText: 'yourname@email.com',
                          filled: true,
                        ),
                        validator: _validateEmail, // <-- use new validator
                      ),

                      const SizedBox(height: 20),
                      // Get Token / Permission
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _requestPermissionAndGetToken,
                          icon: const Icon(Icons.vpn_key),
                          label: const Text('Enable Notifications & Get Token'),
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      const SizedBox(height: 8),
                      // Submit to server (optional)
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _submitAndSendToServer,
                          icon: const Icon(Icons.send),
                          label: const Text('Submit'),
                          style: FilledButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Name, Gmail, and token are saved locally on this device.',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
