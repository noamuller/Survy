# Qualtrics Server

This project is a server application that integrates with Qualtrics to handle user sign-ins, store user emails and Firebase Cloud Messaging (FCM) tokens, and send push notifications when a survey is sent to the user's email.

## Project Structure

```
qualtrics-server
├── src
│   ├── app.js                # Entry point of the application
│   ├── controllers           # Contains controllers for handling requests
│   │   ├── authController.js  # Handles user authentication
│   │   ├── notificationController.js # Manages sending notifications
│   │   └── userController.js  # Handles user-related operations
│   ├── routes                # Contains route definitions
│   │   ├── authRoutes.js      # Authentication routes
│   │   ├── notificationRoutes.js # Notification routes
│   │   └── userRoutes.js      # User-related routes
│   ├── services              # Contains service classes for external interactions
│   │   ├── qualtricsService.js # Interacts with the Qualtrics API
│   │   └── fcmService.js      # Manages FCM notifications
│   ├── models                # Contains data models
│   │   └── user.js            # User data model
│   └── config                # Configuration settings
│       └── index.js           # Application configuration
├── package.json              # NPM configuration file
└── README.md                 # Project documentation
```

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd qualtrics-server
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the root directory and add your configuration settings, such as API keys and database connection details.

4. **Run the application:**
   ```
   npm start
   ```

5. **Access the server:**
   Open your browser and navigate to `http://localhost:3000` to see the server running.

## Usage Guidelines

- **User Authentication:** Use the authentication routes to sign in users and store their email and FCM tokens.
- **Sending Notifications:** When a survey is sent to a user's email, the server will trigger push notifications using the FCM service.
- **User Management:** Access user-related routes to retrieve and manage user data.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.