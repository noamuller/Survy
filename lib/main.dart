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
import 'package:url_launcher/url_launcher.dart';
import 'package:path_provider/path_provider.dart';


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
String? validateEmail(String? value) {
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

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});
  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  bool _isRegistered = false;
  String _username = '';

  @override
  void initState() {
    super.initState();
    logToFile("Test log entry");
    _checkRegistration(); 
  }

  Future<void> _checkRegistration() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _isRegistered = prefs.getBool('isRegistered') ?? false;
      _username = prefs.getString('name') ?? '';
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Qualtrics Portal',
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.blue, // Change to blue
        brightness: Brightness.light,
      ),
      home: _isRegistered
          ? SecondPage(username: _username)
          : SignUpPage(onRegistered: _checkRegistration),
    );
  }
}

class SignUpPage extends StatefulWidget {
  final VoidCallback? onRegistered; // <-- Add this line

  const SignUpPage({super.key, this.onRegistered}); // <-- Update constructor

  @override
  State<SignUpPage> createState() => _SignUpPageState();
}
class RegistrationSuccessPage extends StatelessWidget {
  final String username;
  const RegistrationSuccessPage({super.key, required this.username});

  @override
  Widget build(BuildContext context) {
    // Navigate to SecondPage after 1 second
    Future.delayed(const Duration(seconds: 1), () {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => SecondPage(username: username)),
      );
    });

    return Scaffold(
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
        //_showSnack('Notifications permission denied.');
        return;
      }

      // 2) Get FCM token (APNs token must exist on iOS real device)
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) {
        //_showSnack('Could not obtain FCM token. Try again.');
        return;
      }

      await _saveToken(token);
      if (!mounted) return;
      setState(() => _token = token);
      //_showSnack('FCM token retrieved.');
    } catch (e) {
      //_showSnack('Error getting token: $e');
    }
  }

  Future<void> _submitAndSendToServer() async {
  FocusScope.of(context).unfocus();
  final valid = _formKey.currentState?.validate() ?? false;
  if (!valid) return;

  final name = _nameCtrl.text.trim();
  final email = _emailCtrl.text.trim();

  await _saveBasics(name, email);

  try {
    //_showSnack('Submitting to server...');
    logToFile('POST https://api-go537uh5jq-uc.a.run.app/api/users');
    logToFile('Body: ${jsonEncode({
      "username": name,
      "fcmToken": _token,
      "emails": [email],
    })}');
    final resp = await http.post(
      Uri.parse('https://api-go537uh5jq-uc.a.run.app/api/users'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        "username": name,
        "fcmToken": _token,
        "emails": [email],
      }),
    );
    logToFile('Response: ${resp.statusCode} ${resp.body}');
    if (resp.statusCode == 201) {
      final data = jsonDecode(resp.body);
      final userId = data['user']?['id'];
      if (userId == null) {
        logToFile('Registration failed: No user ID in response: ${resp.body}');
        return;
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_id', userId);
      await prefs.setBool('isRegistered', true);
      if (widget.onRegistered != null) widget.onRegistered!();
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => RegistrationSuccessPage(username: name)),
      );
    } else {
      //_showSnack('Server error: ${resp.statusCode} ${resp.reasonPhrase}');
    }
  } catch (e) {
    logToFile('Registration error: $e');
    //_showSnack('Network error: $e');
  }
}

  void _copyToken() {
    if (_token.isEmpty) {
      //_showSnack('No token yet.');
      return;
    }
    Clipboard.setData(ClipboardData(text: _token));
    //_showSnack('Token copied to clipboard.');
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
            colors: [
              Color(0xFF1976D2), // Blue 700
              Color(0xFF42A5F5), // Blue 400
              Color(0xFF90CAF9), // Blue 200
            ],
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
                        'Enter your name and Email registered for Qualtrics.',
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
                        validator: validateEmail, // <-- use new validator
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

class SecondPage extends StatefulWidget {
  final String username;
  const SecondPage({super.key, required this.username});

  @override
  State<SecondPage> createState() => _SecondPageState();
}

class _SecondPageState extends State<SecondPage> {
  List<Survey> _surveys = [];

  @override
  void initState() {
    super.initState();
    _loadSurveys();
    FirebaseMessaging.onMessage.listen(_handlePush);
    FirebaseMessaging.onMessageOpenedApp.listen(_handlePush);
  }

  Future<void> _loadSurveys() async {
    final surveys = await loadSurveys();
    setState(() => _surveys = surveys);
  }

  Future<void> _handlePush(RemoteMessage message) async {
    final data = message.data;
    logToFile('Push data received: $data');
    // Accept both 'url' and 'surveyLink' for compatibility
    final link = data['url'] ?? data['surveyLink'];
    if (link != null) {
      final survey = Survey(
        link: link,
        name: data['surveyName'] ?? 'Survey',
        client: data['clientName'] ?? '',
      );
      setState(() {
        _surveys.add(survey);
      });
      await saveSurveys(_surveys);
    }
  }

  Future<void> _removeSurvey(int index) async {
    setState(() {
      _surveys.removeAt(index);
    });
    await saveSurveys(_surveys);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
        actions: [
          TextButton.icon(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const UserSettingsPage()),
              );
            },
            icon: const Icon(Icons.settings, color: Colors.blue),
            label: const Text('User Settings', style: TextStyle(color: Colors.blue)),
          ),
        ],
        leading: Padding(
          padding: const EdgeInsets.all(8.0),
          child: CircleAvatar(
            child: Text(widget.username.isNotEmpty ? widget.username[0].toUpperCase() : '?'),
          ),
        ),
      ),
      body: _surveys.isEmpty
          ? const Center(child: Text('No available surveys currently'))
          : ListView.builder(
              padding: const EdgeInsets.all(24),
              itemCount: _surveys.length,
              itemBuilder: (context, index) {
                final survey = _surveys[index];
                return InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () async {
                    final uri = Uri.parse(survey.link);
                    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
                      // Optionally show an error to the user
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Could not launch survey link')),
                      );
                    }
                  },
                  child: Card(
                    margin: const EdgeInsets.only(bottom: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    child: ListTile(
                      title: Text(survey.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text('Client: ${survey.client}'),
                      trailing: IconButton(
                        icon: const Icon(Icons.check_circle, color: Colors.green),
                        onPressed: () => _removeSurvey(index),
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
class UserSettingsPage extends StatefulWidget {
  const UserSettingsPage({super.key});

  @override
  State<UserSettingsPage> createState() => _UserSettingsPageState();
}

class _UserSettingsPageState extends State<UserSettingsPage> {
  String? _username;
  String? _email;
  List<String> _additionalEmails = [];
  bool _showEmailsSection = false;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _username = prefs.getString('name') ?? '';
      _email = prefs.getString('email') ?? '';
      _additionalEmails = prefs.getStringList('additional_emails') ?? [];
    });
  }

  Future<void> _saveAdditionalEmails() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('additional_emails', _additionalEmails);
  }

  Future<void> _deleteAccount() async {
    logToFile("Delete account triggered"); 
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getString('user_id');
    if (userId == null) return;
    try {
      logToFile('DELETE https://api-go537uh5jq-uc.a.run.app/api/users/$userId');
      final resp = await http.delete(
        Uri.parse('https://api-go537uh5jq-uc.a.run.app/api/users/$userId'),
      );
      logToFile('Response: ${resp.statusCode} ${resp.body}');
      if (resp.statusCode == 200) {
        await prefs.clear();
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => SignUpPage()),
          (route) => false,
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Server error: ${resp.body}')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to delete account: $e')),
      );
    }
  }

  Future<void> _changeMailOrUsername() async {
    final nameCtrl = TextEditingController(text: _username);
    final emailCtrl = TextEditingController(text: _email);
    final formKey = GlobalKey<FormState>();

    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Change Mail/Username'),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Name'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter name' : null,
              ),
              TextFormField(
                controller: emailCtrl,
                decoration: const InputDecoration(labelText: 'Email'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter email' : null,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (formKey.currentState?.validate() ?? false) {
                final prefs = await SharedPreferences.getInstance();
                await prefs.setString('name', nameCtrl.text.trim());
                await prefs.setString('email', emailCtrl.text.trim());
                setState(() {
                  _username = nameCtrl.text.trim();
                  _email = emailCtrl.text.trim();
                });
                Navigator.pop(context);
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> _addMail() async {
    setState(() {
      _showEmailsSection = !_showEmailsSection;
    });
  }

  Future<void> _addNewEmail() async {
  final emailCtrl = TextEditingController();
  final formKey = GlobalKey<FormState>();
  await showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Add Email'),
      content: SingleChildScrollView(
        child: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: emailCtrl,
                decoration: const InputDecoration(labelText: 'Additional Email'),
                validator: validateEmail,
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        ElevatedButton(
          onPressed: () async {
            if (formKey.currentState?.validate() ?? false) {
              final newEmail = emailCtrl.text.trim();
              final prefs = await SharedPreferences.getInstance();
              final userId = prefs.getString('user_id');
              if (userId == null) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('User ID not found.')),
                );
                return;
              }
              try {
                logToFile('POST https://api-go537uh5jq-uc.a.run.app/api/users/$userId/emails');
                logToFile('Body: ${jsonEncode({"email": newEmail})}');
                final resp = await http.post(
                  Uri.parse('https://api-go537uh5jq-uc.a.run.app/api/users/$userId/emails'),
                  headers: {'Content-Type': 'application/json'},
                  body: jsonEncode({"email": newEmail}),
                );
                logToFile('Response: ${resp.statusCode} ${resp.body}');
                if (resp.statusCode == 200) {
                  setState(() {
                    _additionalEmails.add(newEmail);
                  });
                  await _saveAdditionalEmails();
                  Navigator.pop(context);
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Server error: ${resp.body}')),
                  );
                }
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Failed to send to server: $e')),
                );
              }
            }
          },
          child: const Text('Add'),
        ),
      ],
    ),
  );
}

  void _removeMail(int index) async {
  final prefs = await SharedPreferences.getInstance();
  final userId = prefs.getString('user_id');
  final emailToRemove = _additionalEmails[index];
  if (userId == null) return;
  try {
    logToFile('DELETE https://api-go537uh5jq-uc.a.run.app/api/users/$userId/emails');
    logToFile('Body: ${jsonEncode({"email": emailToRemove})}');
    final resp = await http.delete(
      Uri.parse('https://api-go537uh5jq-uc.a.run.app/api/users/$userId/emails'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({"email": emailToRemove}),
    );
    logToFile('Response: ${resp.statusCode} ${resp.body}');
    if (resp.statusCode == 200) {
      setState(() {
        _additionalEmails.removeAt(index);
      });
      await _saveAdditionalEmails();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Server error: ${resp.body}')),
      );
    }
  } catch (e) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Failed to remove email: $e')),
    );
  }
}

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('User Settings')),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CircleAvatar(
              radius: 40,
              child: Text(
                (_username?.isNotEmpty ?? false) ? _username![0].toUpperCase() : '?',
                style: const TextStyle(fontSize: 32),
              ),
            ),
            const SizedBox(height: 16),
            Center(
              child: Text(
                _username ?? '',
                style: theme.textTheme.headlineSmall,
              ),
            ),
            Center(
              child: Text(
                _email ?? '',
                style: theme.textTheme.bodyMedium,
              ),
            ),
            const SizedBox(height: 32),
            OutlinedButton.icon(
              icon: const Icon(Icons.delete, color: Colors.blue),
              label: const Text('Delete Account', style: TextStyle(fontSize: 18, color: Colors.blue)),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 18),
                side: const BorderSide(color: Colors.blue),
              ),
              onPressed: _deleteAccount,
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              icon: const Icon(Icons.mail, color: Colors.blue),
              label: const Text('Add Mail for Account', style: TextStyle(fontSize: 18, color: Colors.blue)),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 18),
                backgroundColor: Colors.white,
                side: const BorderSide(color: Colors.blue),
              ),
              onPressed: () {
                setState(() {
                  _showEmailsSection = !_showEmailsSection;
                });
              },
            ),
            if (_showEmailsSection) ...[
              const SizedBox(height: 16),
              Text(
                'Emails for this account:',
                style: theme.textTheme.titleMedium,
              ),
              // Combine main email and additional emails into one list
              ...([_email ?? ''] + _additionalEmails).asMap().entries.map((entry) {
                final idx = entry.key;
                final email = entry.value;
                return ListTile(
                  leading: const Icon(Icons.email, color: Colors.blue),
                  title: Text(email),
                  trailing: IconButton(
                    icon: const Icon(Icons.remove, color: Colors.red),
                    onPressed: () async {
                      final prefs = await SharedPreferences.getInstance();
                      final userId = prefs.getString('user_id');
                      final emailToRemove = email;
                      if (userId == null) return;
                      try {
                        logToFile('DELETE https://api-go537uh5jq-uc.a.run.app/api/users/$userId/emails');
                        logToFile('Body: ${jsonEncode({"email": emailToRemove})}');
                        final resp = await http.delete(
                          Uri.parse('https://api-go537uh5jq-uc.a.run.app/api/users/$userId/emails'),
                          headers: {'Content-Type': 'application/json'},
                          body: jsonEncode({"email": emailToRemove}),
                        );
                        logToFile('Response: ${resp.statusCode} ${resp.body}');
                        if (resp.statusCode == 200) {
                          setState(() {
                            if (idx == 0) {
                              _email = '';
                              prefs.remove('email');
                            } else {
                              _additionalEmails.removeAt(idx - 1);
                              _saveAdditionalEmails();
                            }
                          });
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Server error: ${resp.body}')),
                          );
                        }
                      } catch (e) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Failed to remove email: $e')),
                        );
                      }
                    },
                  ),
                );
              }),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  icon: const Icon(Icons.add, color: Colors.blue),
                  label: const Text('Add Email', style: TextStyle(color: Colors.blue)),
                  onPressed: _addNewEmail,
                ),
              ),
            ],
            const SizedBox(height: 16),
            ElevatedButton.icon(
              icon: const Icon(Icons.edit),
              label: const Text('Change Mail/Username', style: TextStyle(fontSize: 18)),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 18),
              ),
              onPressed: _changeMailOrUsername,
            ),
          ],
        ),
      ),
    );
  }
}
Future<void> logToFile(String message) async {
  final file = File('api_log.txt'); // This will be in your project root (next to README.md)
  final timestamp = DateTime.now().toIso8601String();
  await file.writeAsString('[$timestamp] $message\n', mode: FileMode.append);
}
class Survey {
  final String link;
  final String name;
  final String client;

  Survey({required this.link, required this.name, required this.client});

  Map<String, dynamic> toJson() => {
    'link': link,
    'name': name,
    'client': client,
  };

  factory Survey.fromJson(Map<String, dynamic> json) => Survey(
    link: json['link'] ?? '',
    name: json['name'] ?? '',
    client: json['client'] ?? '',
  );
}
Future<void> saveSurveys(List<Survey> surveys) async {
  final prefs = await SharedPreferences.getInstance();
  final list = surveys.map((s) => jsonEncode(s.toJson())).toList();
  await prefs.setStringList('surveys', list);
}

Future<List<Survey>> loadSurveys() async {
  final prefs = await SharedPreferences.getInstance();
  final list = prefs.getStringList('surveys') ?? [];
  return list.map((s) => Survey.fromJson(jsonDecode(s))).toList();
}