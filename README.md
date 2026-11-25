# CampusFest Backend

A REST API backend for **CampusFest**, a campus event platform that supports user authentication, event management, event registrations, product browsing, shopping carts, and order processing.

## Features

- **User Authentication:** JWT-based authentication, password hashing, and profile management.
- **Event Management:** Create, retrieve, update, and delete campus events.
- **Event Registrations:** Event registration workflows and team-size validation.
- **Product Management:** Product APIs, validation, and image uploads.
- **Shopping Cart:** Add, retrieve, update, and remove cart items.
- **Order Management:** Order processing, inventory handling, and cancellation workflows.
- **Payment Safeguards:** Cash on Delivery (COD) support; unverified online payment methods are rejected.
- **Image Storage:** ImageKit integration for image uploads.
- **Security:** Environment-based configuration, CORS controls, and centralized error handling.
- **Automated Testing:** Tests covering authentication, validation, inventory, payment restrictions, and order transaction behaviour.

## Tech Stack

| Category | Technologies |
|---|---|
| Runtime | Node.js |
| Backend | Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JSON Web Tokens (JWT), bcryptjs |
| Middleware | CORS, cookie-parser, Multer |
| Image Storage | ImageKit |
| Testing | Node.js built-in test runner, mongodb-memory-server |

## Getting Started

### Prerequisites

Install or configure the following:

- Node.js and npm
- A MongoDB connection URI
- ImageKit credentials if using image upload functionality

### 1. Clone the Repository

```bash
git clone https://github.com/Shyna-Garg/CampusFest-Backend.git
cd CampusFest-Backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a local `.env` file using the example configuration:

```bash
cp .env.example .env
```

Update `.env` with the appropriate values for your environment:

```env
PORT=3000
NODE_ENV=development
CORS_ALLOWED_ORIGINS=http://localhost:5173
MONGO_URI=your_mongodb_connection_uri
JWT_SECRET=your_jwt_secret
IMAGE_PUBLIC_KEY=your_imagekit_public_key
IMAGE_PRIVATE_KEY=your_imagekit_private_key
IMAGE_URL_ENDPOINT=your_imagekit_url_endpoint
```

Use actual credentials only in your local `.env` file. Never commit database credentials, JWT secrets, private API keys, or other sensitive information. The repository's `.gitignore` excludes local environment files.

### 4. Start the Server

```bash
node server.js
```

The default port is `3000`, unless overridden by the `PORT` environment variable.

### 5. Run Automated Tests

```bash
npm test
```

The test suite uses Node.js's built-in test runner. Some integration tests use an in-memory MongoDB replica set to exercise transaction behaviour.

## Project Structure

```text
CampusFest-Backend/
├── server.js
├── package.json
├── .env.example
├── src/
│   ├── app.js
│   ├── config/
│   ├── controller/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   └── utils/
├── test/
└── docs/
    ├── API.md
    └── postman/
        └── CampusFest Backend API.postman_collection.json
```

## API Documentation

Detailed API documentation is available in [`docs/API.md`](docs/API.md).

The documentation covers the available route groups:

- Authentication
- Events
- Registrations
- Products
- Shopping Cart
- Orders

## Postman Collection

The exported Postman collection is available here:

[`CampusFest Backend API.postman_collection.json`](docs/postman/CampusFest%20Backend%20API.postman_collection.json)

To use it:

1. Import the JSON file into Postman.
2. Set the collection variable `baseUrl` to `http://localhost:3000`.
3. Start the backend server.
4. Authenticate before using protected endpoints.

Keep passwords, tokens, and other secrets out of shared collections.

## Testing and Reliability

The automated test suite covers authentication, CORS behaviour, product validation, payment restrictions, inventory updates, and order transaction rollback scenarios.

Run the tests locally before submitting changes:

```bash
npm test
```

## Current Scope

This repository contains the backend implementation, API documentation, Postman collection, and automated tests. A deployed production API, completed frontend integration, and verified online payment processing should not be assumed unless separately configured and tested.

## API Documentation

Detailed API documentation is available in [`docs/API.md`](docs/API.md).

## Postman Collection

Import the exported collection into Postman to explore the available API requests.

[CampusFest Backend API Collection](docs/postman/CampusFest%20Backend%20API.postman_collection.json)

Set the collection variable `baseUrl` to `http://localhost:3000` before using the requests.

## Author

**Shyna Garg**

- GitHub: [Shyna-Garg](https://github.com/Shyna-Garg)
- Repository: [CampusFest Backend](https://github.com/Shyna-Garg/CampusFest-Backend)
