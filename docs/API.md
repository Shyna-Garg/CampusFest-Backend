# CampusFest Backend API Documentation

## Overview

CampusFest Backend provides REST APIs for user authentication, event management, event registrations, product management, shopping cart operations, and order processing.

**Base URL:** `http://localhost:3000`

**API Prefix:** `/api`

## Authentication

Protected endpoints require a valid authenticated user session. Admin-only endpoints require an administrator account.

The authentication system uses a login cookie named `token`. Requests to protected endpoints must include valid authentication credentials.

## 1. Authentication APIs

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/auth/register` | Register a new user | Public |
| POST | `/api/auth/login` | Log in a user | Public |
| POST | `/api/auth/logout` | Log out a user | Public |
| GET | `/api/auth/profile` | Get the current user's profile | Authenticated |
| PUT | `/api/auth/profile` | Update the current user's profile | Authenticated |

### Register User

**Request body:**

```json
{
  "username": "testuser",
  "email": "testuser@example.com",
  "password": "your-password"
}
```

### Login User

**Request body:**

```json
{
  "email": "testuser@example.com",
  "password": "your-password"
}
```

### Update Profile

Accepts `username`, `email`, or both fields in the JSON request body.

## 2. Event APIs

| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/events` | Retrieve all events | Public |
| GET | `/api/events/:id` | Retrieve an event by ID | Public |
| POST | `/api/events` | Create an event | Admin |
| PUT | `/api/events/:id` | Update an event | Admin |
| DELETE | `/api/events/:id` | Delete an event | Admin |

### Create Event

**Request body:**

```json
{
  "title": "Hackathon 2026",
  "description": "A campus coding competition",
  "date": "2027-06-15T10:00:00.000Z",
  "venue": "CGC Landran",
  "price": 0,
  "category": "Technology",
  "minTeamSize": 2,
  "maxTeamSize": 4,
  "capacity": 100
}
```

Required fields include `title`, `venue`, `date`, and `category`. Team-size and date validations are also applied.

## 3. Registration APIs

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/registrations/:eventId` | Register for an event | Authenticated |
| GET | `/api/registrations/my` | Retrieve the current user's registrations | Authenticated |

### Register for Event

The request includes `teamName` and `members`. The members field must be a non-empty array and must satisfy the event's team-size rules.

## 4. Product APIs

| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/products` | Retrieve all products | Public |
| GET | `/api/products/:id` | Retrieve a product by ID | Public |
| POST | `/api/products` | Create a product | Admin |
| PUT | `/api/products/:id` | Update a product | Admin |
| DELETE | `/api/products/:id` | Delete a product | Admin |

Product creation supports an uploaded image using the multipart form-data field `image`.

## 5. Shopping Cart APIs

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/cart` | Add a product to the cart | Authenticated |
| GET | `/api/cart` | Retrieve the current user's cart | Authenticated |
| PUT | `/api/cart/:productId` | Update a cart item's quantity | Authenticated |
| DELETE | `/api/cart/:productId` | Remove an item from the cart | Authenticated |

### Add to Cart

**Request body:**

```json
{
  "productId": "PRODUCT_ID",
  "quantity": 1
}
```

### Update Cart Item

**Request body:**

```json
{
  "quantity": 2
}
```

Cart operations validate product IDs, quantities, product availability, and stock limits.

## 6. Order APIs

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/orders` | Place an order | Authenticated |
| GET | `/api/orders/my` | Retrieve the current user's orders | Authenticated |
| GET | `/api/orders/admin/all` | Retrieve all orders | Admin |
| GET | `/api/orders/:id` | Retrieve an order by ID | Authenticated |
| PUT | `/api/orders/:id/status` | Update an order's status | Admin |
| PUT | `/api/orders/:id/cancel` | Cancel an order | Authenticated |

## Common HTTP Status Codes

| Status | Meaning |
|---|---|
| 200 | Request completed successfully |
| 201 | Resource created successfully |
| 400 | Invalid request or validation error |
| 401 | Authentication required or invalid credentials |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict, such as duplicate registration |
| 500 | Internal server error |

Actual responses depend on the endpoint and its validation rules.

## Postman Collection

The Postman collection is available at:

`docs/postman/CampusFest Backend API.postman_collection.json`

Set the collection variable `baseUrl` to `http://localhost:3000` before using the requests.

## Notes

- Start the backend server before making local API requests.
- Use valid resource IDs for endpoints containing `:id`, `:eventId`, or `:productId`.
- Authenticate before using protected endpoints.
- Do not commit passwords, JWT tokens, database credentials, or other secrets to version control.
