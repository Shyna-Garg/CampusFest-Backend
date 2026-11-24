# CampusFest Backend

A REST API backend for **CampusFest**, a campus event platform designed to support event management, user authentication, registrations, product browsing, shopping carts, and order processing.

## Features

- **Authentication** — User authentication with JWT-based authorization and password hashing.
- **Event management** — API endpoints for managing campus events.
- **Registrations** — Dedicated endpoints for event registration workflows.
- **Product management** — Product-related API endpoints and validation.
- **Shopping cart** — Cart management functionality.
- **Order management** — Order processing, inventory handling, and cancellation workflows.
- **Payment safeguards** — Cash on Delivery (COD) support, with unverified online payment methods rejected.
- **Image uploads** — ImageKit integration with upload middleware.
- **Security and configuration** — Environment-based configuration, CORS controls, and centralized error handling.
- **Automated tests** — Node.js test runner, including inventory, payment, authentication, validation, and transaction integration tests.

## Tech Stack

- **Runtime:** Node.js
- **Backend:** Express.js
- **Database:** MongoDB with Mongoose
- **Authentication:** JSON Web Tokens (JWT), bcryptjs
- **Middleware:** CORS, cookie-parser, Multer
- **Image storage:** ImageKit
- **Testing:** Node.js built-in test runner, mongodb-memory-server

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js and npm
- MongoDB connection URI
- ImageKit credentials if using image upload functionality

### 1. Clone the repository

```bash
git clone https://github.com/Shyna-Garg/CampusFest-Backend.git
cd CampusFest-Backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

Update `.env` with the appropriate values:

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

**Security:** Never commit `.env` or expose database credentials, JWT secrets, or private API keys. The repository's `.gitignore` excludes local environment files.

### 4. Start the server

```bash
node server.js
```

The default port is `3000`, unless overridden by the `PORT` environment variable.

### 5. Run tests

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
└── test/
```

## API Overview

The backend organizes endpoints into route modules for:

- Authentication
- Events
- Registrations
- Products
- Cart
- Orders

For exact endpoint paths, HTTP methods, request payloads, and response formats, refer to the route and controller files in `src/`.

## Testing and Reliability

The test suite covers authentication, CORS behaviour, product validation, payment restrictions, inventory updates, and order transaction rollback scenarios.

Run the tests locally before submitting changes:

```bash
npm test
```

## Current Scope

This repository contains the backend implementation and automated tests. A deployed production API, frontend integration, and verified online payment processing should not be assumed unless separately configured and tested.

## Author

**Shyna Garg**

- GitHub: [@Shyna-Garg](https://github.com/Shyna-Garg)
- Repository: [CampusFest-Backend](https://github.com/Shyna-Garg/CampusFest-Backend)
