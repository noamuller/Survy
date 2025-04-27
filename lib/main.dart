import 'package:flutter/material.dart';

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final _formKey = GlobalKey<FormState>(); // Form key for validation
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  bool _isEmailValid = true; // Track email validity

  // Function to validate email
  void _validateEmail() {
    setState(() {
      _isEmailValid = RegExp(r"^[a-zA-Z0-9.a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
          .hasMatch(_emailController.text);
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(
          backgroundColor: Colors.amber,
          title: const Text('Survy'),
        ),
        body: Stack(
          children: [
            Align(
              alignment: Alignment.topCenter,
              child: Container(
                width: 300,
                margin: const EdgeInsets.only(top: 80),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color.fromARGB(255, 112, 110, 115),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Form(
                  key: _formKey, // Assigning the form key
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Enter your name:',
                        style: TextStyle(color: Colors.white, fontSize: 16),
                      ),
                      TextFormField(
                        controller: _nameController,
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          hintText: 'Your Name',
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Enter your email:',
                        style: TextStyle(color: Colors.white, fontSize: 16),
                      ),
                      TextFormField(
                        controller: _emailController,
                        onChanged: (value) => _validateEmail(), // Validate on change
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(
                              color: _isEmailValid ? Colors.grey : Colors.red, // Change border color if invalid
                            ),
                          ),
                          hintText: 'Your Email',
                          errorText: _isEmailValid ? null : 'Invalid email address', // Show error message if invalid
                        ),
                        keyboardType: TextInputType.emailAddress,
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: () {
                          _validateEmail();
                          if (_isEmailValid) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Email is valid!')),
                            );
                          }
                        },
                        child: const Text('Submit'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

void main() {
  runApp(const MyApp());
}