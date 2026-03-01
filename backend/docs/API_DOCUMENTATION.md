# PSRide API — Technical Documentation

**Version:** 1.2.0
**Base URL (Dev):** `https://jk4sd35xw3.execute-api.eu-west-1.amazonaws.com/dev/api/v1`
**Base URL (Local):** `http://localhost:3000/api/v1`
**Last Updated:** March 1, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Environments](#environments)
3. [Authentication](#authentication)
4. [Request & Response Format](#request--response-format)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Data Types & Validation Rules](#data-types--validation-rules)
8. [Auth Endpoints](#auth-endpoints)
9. [User Endpoints](#user-endpoints)
10. [Ride Endpoints](#ride-endpoints)
11. [Booking Endpoints](#booking-endpoints)
12. [Rating Endpoints](#rating-endpoints)
13. [Notification Endpoints](#notification-endpoints)
14. [Safety Endpoints](#safety-endpoints)
15. [Report Endpoints](#report-endpoints)
16. [Admin Endpoints](#admin-endpoints)
17. [Common Workflows](#common-workflows)
18. [Changelog](#changelog)

---

## Overview

PSRide is a ride-sharing platform for University of Ilorin members (students and staff). Phase 1 uses **cash-only payments** with a **6-digit verification code** flow.

Key concepts:
- A **Driver** is a verified user who creates ride offers and owns a vehicle.
- A **Passenger** is any authenticated user who books a seat on a ride.
- Every ride creation automatically calls the **Mapbox Directions API** to calculate road distance and travel time.
- Booking payment is confirmed in-person with a 6-digit code the passenger shows the driver.

---

## Environments

| Environment | Base URL | Notes |
|-------------|----------|-------|
| **Dev** | `https://jk4sd35xw3.execute-api.eu-west-1.amazonaws.com/dev/api/v1` | Live, for integration testing |
| **Staging** | *(to be deployed)* | Mirrors production config — use before go-live |
| **Production** | *(to be deployed)* | Real users |
| **Local** | `http://localhost:3000/api/v1` | Run `npm run dev` in `backend/` |

All environments share the same API contract. The only differences are the base URL and server-side resource sizing.

---

## Authentication

Most endpoints require a **Bearer JWT token** in the `Authorization` header.

```
Authorization: Bearer <accessToken>
```

Tokens are returned by `/auth/register` and `/auth/login`. They expire after 24 hours by default. Use `/auth/refresh-token` to get a new access token without re-logging in.

### Token Lifecycle

```
Register / Login
      │
      ▼
{ accessToken, refreshToken, expiresIn }
      │
      ├── Use accessToken on every request
      │
      └── When accessToken expires → POST /auth/refresh-token
                with { refreshToken } → new { accessToken, expiresIn }
```

---

## Request & Response Format

All requests and responses use `Content-Type: application/json`.

### Success Response

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... },
  "timestamp": "2026-03-01T08:00:00.000Z"
}
```

### Paginated Response

Paginated endpoints return an additional `pagination` field alongside `data`:

```json
{
  "success": true,
  "message": "Rides found",
  "data": { "rides": [ ... ] },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextPage": 2,
    "prevPage": null
  },
  "timestamp": "2026-03-01T08:00:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "RIDE_NOT_FOUND",
    "message": "Ride not found",
    "details": null
  },
  "timestamp": "2026-03-01T08:00:00.000Z"
}
```

---

## Error Handling

All errors return a consistent JSON body. Use the `error.code` field (not the HTTP status) for programmatic handling.

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| `200` | OK |
| `201` | Created |
| `400` | Bad Request (invalid input, business rule violation) |
| `401` | Unauthorized (missing or invalid token) |
| `403` | Forbidden (authenticated but not allowed) |
| `404` | Not Found |
| `409` | Conflict (duplicate, already exists, time clash) |
| `422` | Validation Error (schema validation failed) |
| `429` | Rate Limit Exceeded |
| `500` | Internal Server Error |

### Error Codes Reference

**Auth errors**

| Code | Meaning |
|------|---------|
| `UNAUTHORIZED` | No token provided |
| `INVALID_TOKEN` | Token is malformed |
| `EXPIRED_TOKEN` | Token has expired — refresh it |
| `INVALID_REFRESH_TOKEN` | Refresh token invalid or expired |
| `INVALID_CREDENTIALS` | Wrong email or password |
| `ACCOUNT_NOT_VERIFIED` | Email not verified yet |
| `ACCOUNT_SUSPENDED` | Account suspended by admin |

**User errors**

| Code | Meaning |
|------|---------|
| `USER_NOT_FOUND` | User does not exist |
| `EMAIL_EXISTS` | Email already registered |
| `PHONE_EXISTS` | Phone already registered |
| `ALREADY_DRIVER` | User already registered as driver |

**Ride errors**

| Code | Meaning |
|------|---------|
| `RIDE_NOT_FOUND` | Ride does not exist |
| `RIDE_TIME_CONFLICT` | Driver has another ride within 30 min |
| `NO_SEATS_AVAILABLE` | Ride is fully booked |
| `DEPARTURE_IN_PAST` | Departure time is in the past |
| `DRIVER_NOT_VERIFIED` | Driver not approved yet |
| `VEHICLE_NOT_FOUND` | No approved vehicle found |

**Booking errors**

| Code | Meaning |
|------|---------|
| `BOOKING_NOT_FOUND` | Booking does not exist |
| `ALREADY_BOOKED` | Passenger already has a booking on this ride |
| `CANNOT_BOOK_OWN_RIDE` | Driver cannot book their own ride |
| `INVALID_PASSENGER_CODE` | Wrong 6-digit verification code |

---

## Rate Limiting

| Endpoint Group | Limit |
|----------------|-------|
| General API | 100 requests / 15 min |
| Auth endpoints | 20 requests / 15 min |
| Login | 10 requests / 15 min |
| Password reset | 5 requests / 15 min |
| OTP | 5 requests / 15 min |
| Search | 30 requests / 15 min |
| Booking creation | 10 requests / 15 min |
| SOS | 5 requests / 15 min |

When rate-limited you receive `429` with headers:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1740825600
```

---

## Data Types & Validation Rules

### Nigerian Phone Number
Pattern: `^(\+?234|0)[789][01]\d{8}$`
Examples: `08012345678`, `+2348012345678`

### Vehicle Plate Number
Pattern: `^[A-Z]{2,3}-\d{3}-[A-Z]{2}$`
Example: `KWL-123-AB`

### Student Matric Number
Pattern: `^\d{2}/\d{2}[A-Z]{2,4}\d{3}$`
Example: `21/52HP029`

### Staff ID
Pattern: `^[A-Z]{2,4}/\d{4}/\d{3,4}$`
Example: `SS/2020/001`

### Password
Minimum 8 characters. Must contain at least one uppercase letter, one lowercase letter, and one number.

### Date & Time Formats
- `departureDate` → `YYYY-MM-DD` e.g. `"2026-03-01"`
- `departureTime` → `HH:MM` (24-hour) e.g. `"08:00"`
- Timestamps → ISO 8601 e.g. `"2026-03-01T08:00:00.000Z"`

### Location Object

Every location field uses this shape:

```json
{
  "address": "University of Ilorin Main Gate",
  "coordinates": {
    "latitude": 8.4799,
    "longitude": 4.5418
  },
  "placeId": null,
  "landmark": null
}
```

> **Important:** coordinates use `latitude` / `longitude` (not `lat` / `lng`).

---

## Auth Endpoints

### POST /auth/register

Register a new student or staff account.

**No auth required.**

**Request Body**

```json
{
  "email": "john.doe@unilorin.edu.ng",
  "password": "Password123",
  "confirmPassword": "Password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "08012345678",
  "role": "student",
  "matricNumber": "21/52HP029",
  "department": "Electrical Engineering",
  "faculty": "Engineering"
}
```

For `role: "staff"` use `staffId` instead of `matricNumber`:

```json
{
  "role": "staff",
  "staffId": "SS/2020/001"
}
```

**Field Rules**

| Field | Required | Notes |
|-------|----------|-------|
| `email` | ✅ | Must be unique |
| `password` | ✅ | Min 8 chars, 1 upper, 1 lower, 1 number |
| `confirmPassword` | ✅ | Must match `password` |
| `firstName` | ✅ | 2–50 chars |
| `lastName` | ✅ | 2–50 chars |
| `phone` | ✅ | Nigerian format. Must be unique |
| `role` | ✅ | `student` or `staff` |
| `matricNumber` | If student | Pattern: `21/52HP029` |
| `staffId` | If staff | Pattern: `SS/2020/001` |
| `department` | ❌ | Max 100 chars |
| `faculty` | ❌ | Max 100 chars |

**Response `201`**

```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "user": {
      "userId": "5b6ffaf1-d713-470a-b5e0-742169cb5c00",
      "email": "john.doe@unilorin.edu.ng",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "08012345678",
      "role": "student",
      "isDriver": false,
      "emailVerified": false,
      "status": "active",
      "createdAt": "2026-03-01T08:00:00.000Z"
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "c6a11ec5...",
    "expiresIn": "24h",
    "tokenType": "Bearer"
  }
}
```

**Error Codes:** `EMAIL_EXISTS` (409), `PHONE_EXISTS` (409), `VALIDATION_ERROR` (422)

---

### POST /auth/login

**No auth required.**

**Request Body**

```json
{
  "email": "john.doe@unilorin.edu.ng",
  "password": "Password123"
}
```

**Response `200`**

```json
{
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGci...",
    "refreshToken": "c6a11ec5...",
    "expiresIn": "24h",
    "tokenType": "Bearer"
  }
}
```

**Error Codes:** `INVALID_CREDENTIALS` (401), `ACCOUNT_SUSPENDED` (403), `ACCOUNT_NOT_VERIFIED` (403)

---

### POST /auth/verify-email

Verify account email address with token sent by email.

**No auth required.**

**Request Body**

```json
{ "token": "abc123def456..." }
```

**Response `200`:** `{ "message": "Email verified successfully" }`

---

### POST /auth/resend-verification

**No auth required.**

**Request Body**

```json
{ "email": "john.doe@unilorin.edu.ng" }
```

---

### POST /auth/forgot-password

**No auth required.** Rate limited: 5 req/15 min.

**Request Body**

```json
{ "email": "john.doe@unilorin.edu.ng" }
```

Always returns `200` (does not confirm if email exists, for security).

---

### POST /auth/reset-password

**No auth required.** Rate limited: 5 req/15 min.

**Request Body**

```json
{
  "token": "reset-token-from-email",
  "password": "NewPassword123",
  "confirmPassword": "NewPassword123"
}
```

---

### POST /auth/refresh-token

Get a new access token without re-logging in.

**No auth required.**

**Request Body**

```json
{ "refreshToken": "c6a11ec5..." }
```

**Response `200`**

```json
{
  "data": {
    "accessToken": "eyJhbGci...",
    "expiresIn": "24h"
  }
}
```

---

### GET /auth/me

Get the currently authenticated user's profile.

**Auth required.**

**Response `200`** — returns full `User` object.

---

### POST /auth/change-password

**Auth required.**

**Request Body**

```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword123",
  "confirmPassword": "NewPassword123"
}
```

---

### POST /auth/logout

Invalidates the current session token.

**Auth required.** No request body.

---

### POST /auth/logout-all

Invalidates all active sessions for the user.

**Auth required.** No request body.

---

### GET /auth/sessions

List all active sessions.

**Auth required.**

---

### DELETE /auth/sessions/{sessionId}

Revoke a specific session.

**Auth required.**

---

### POST /auth/send-otp

Send OTP to a phone number for verification.

**Auth required.** Rate limited: 5 req/15 min.

**Request Body**

```json
{ "phone": "08012345678" }
```

---

### POST /auth/verify-otp

**Auth required.** Rate limited: 5 req/15 min.

**Request Body**

```json
{ "otp": "123456" }
```

---

## User Endpoints

### GET /users/profile

Get the authenticated user's own profile.

**Auth required.**

**Response `200`**

```json
{
  "data": {
    "user": {
      "userId": "5b6ffaf1-...",
      "email": "john.doe@unilorin.edu.ng",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "08012345678",
      "role": "student",
      "matricNumber": "21/52HP029",
      "department": "Electrical Engineering",
      "faculty": "Engineering",
      "profilePhoto": null,
      "bio": null,
      "isDriver": false,
      "driverVerified": false,
      "emailVerified": true,
      "status": "active",
      "averageRating": 4.7,
      "totalRatings": 12,
      "createdAt": "2026-03-01T08:00:00.000Z"
    }
  }
}
```

---

### PUT /users/profile

Update profile fields.

**Auth required.**

**Request Body** (all fields optional)

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "08012345678",
  "department": "Computer Science",
  "faculty": "Communication and Information Sciences",
  "profilePhoto": "https://example.com/photo.jpg",
  "bio": "Final year student"
}
```

---

### DELETE /users/profile

Permanently delete own account.

**Auth required.** No request body.

---

### GET /users/statistics

**Auth required.** Returns ride and booking counts, ratings.

---

### GET /users/ride-history

**Auth required.** Returns paginated list of past rides.

---

### GET /users/{userId}

Get any user's public profile.

**Auth required.**

---

### POST /users/driver/register

Register the current user as a driver. Requires **verified email**.

**Auth required.**

**Request Body**

```json
{
  "licenseNumber": "NIG-123456",
  "licenseExpiry": "2028-06-01",
  "vehicle": {
    "make": "Toyota",
    "model": "Corolla",
    "year": 2020,
    "color": "White",
    "plateNumber": "KWL-123-AB",
    "capacity": 4,
    "vehicleType": "sedan"
  }
}
```

`vehicleType` enum: `sedan`, `suv`, `minivan`, `hatchback`

**Response `201`** — returns updated user profile with `isDriver: true`.

**Error Codes:** `ALREADY_DRIVER` (409), `PLATE_NUMBER_EXISTS` (409)

---

### GET /users/driver/status

Check driver verification status.

**Auth required.**

**Response `200`**

```json
{
  "data": {
    "isDriver": true,
    "driverVerificationStatus": "pending",
    "documents": []
  }
}
```

`driverVerificationStatus` values: `pending`, `verified`, `rejected`

---

### POST /users/driver/documents

Upload a driver verification document. Requires **verified email**.

**Auth required.**

**Request Body**

```json
{
  "documentType": "license",
  "documentUrl": "https://s3.amazonaws.com/..."
}
```

---

### GET /users/vehicles

Get the authenticated user's vehicles.

**Auth required.**

---

### POST /users/vehicles

Add a new vehicle. Requires **verified email**.

**Auth required.**

**Request Body**

```json
{
  "make": "Toyota",
  "model": "Corolla",
  "year": 2020,
  "color": "White",
  "plateNumber": "KWL-123-AB",
  "capacity": 4,
  "vehicleType": "sedan",
  "insuranceNumber": "INS-001",
  "insuranceExpiry": "2027-01-01"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `make` | ✅ | Max 50 chars |
| `model` | ✅ | Max 50 chars |
| `year` | ✅ | Min 2000 |
| `color` | ✅ | Max 30 chars |
| `plateNumber` | ✅ | Format: `KWL-123-AB`. Must be unique |
| `capacity` | ✅ | 1–7 |
| `vehicleType` | ✅ | `sedan`, `suv`, `minivan`, `hatchback` |
| `insuranceNumber` | ❌ | |
| `insuranceExpiry` | ❌ | Must be a future date |

**Error Codes:** `VEHICLE_PLATE_EXISTS` (409), max 3 vehicles per driver

---

### PUT /users/vehicles/{vehicleId}

Update a vehicle.

**Auth required.**

**Request Body** (all optional)

```json
{
  "color": "Black",
  "capacity": 4,
  "insuranceNumber": "INS-002",
  "insuranceExpiry": "2028-01-01",
  "isActive": true
}
```

---

### DELETE /users/vehicles/{vehicleId}

Remove a vehicle.

**Auth required.**

---

### GET /users/emergency-contacts

List emergency contacts.

**Auth required.**

---

### POST /users/emergency-contacts

**Auth required.**

**Request Body**

```json
{
  "name": "Jane Doe",
  "phone": "08098765432",
  "relationship": "Sister",
  "email": "jane.doe@gmail.com"
}
```

---

### PUT /users/emergency-contacts/{contactId}

**Auth required.** Same body as POST.

---

### DELETE /users/emergency-contacts/{contactId}

**Auth required.**

---

### GET /users/preferences

Get user preferences (ride matching, notification settings).

**Auth required.**

---

### PUT /users/preferences

Update user preferences.

**Auth required.** Free-form preferences object.

---

## Ride Endpoints

### GET /rides/search

Search for available rides. **No auth required** (optional auth).

Rate limited: 30 req/15 min.

**Query Parameters**

| Param | Required | Type | Notes |
|-------|----------|------|-------|
| `date` | ✅ | string | `YYYY-MM-DD` |
| `time` | ❌ | string | `HH:MM` — filters within ±2 hours |
| `fromLat` | ❌ | number | Start latitude |
| `fromLng` | ❌ | number | Start longitude |
| `toLat` | ❌ | number | End latitude |
| `toLng` | ❌ | number | End longitude |
| `seats` | ❌ | integer | Min seats needed (default: 1) |
| `maxPrice` | ❌ | number | Max price per seat |
| `radius` | ❌ | number | Search radius in km (default: 2, max: 10) |
| `page` | ❌ | integer | Default: 1 |
| `limit` | ❌ | integer | Default: 20, max: 100 |
| `sortBy` | ❌ | string | Field to sort by |
| `sortOrder` | ❌ | string | `asc` or `desc` (default: `desc`) |

**Example Request**

```
GET /rides/search?date=2026-03-01&time=08:00&fromLat=8.4799&fromLng=4.5418&seats=1
```

**Response `200`** — paginated list of `Ride` objects.

---

### GET /rides/popular-routes

Get popular routes. **No auth required.**

---

### GET /rides

Get all currently available rides.

**Auth required.**

---

### POST /rides

Create a new ride offer.

**Auth required. Verified driver with approved vehicle required.**

> **Mapbox Integration:** The API automatically calls the **Mapbox Directions API** to calculate the road distance and travel time between your start point, any pickup points, and the destination. This populates `route.distance` (km) and `route.estimatedDuration` (minutes) and `route.polyline` (encoded route geometry for map display). If Mapbox is unavailable, a straight-line Haversine estimate is used and `route.polyline` will be `null`.

**Request Body**

```json
{
  "departureDate": "2026-03-01",
  "departureTime": "08:00",
  "startLocation": {
    "address": "University of Ilorin Main Gate",
    "coordinates": {
      "latitude": 8.4799,
      "longitude": 4.5418
    }
  },
  "endLocation": {
    "address": "Ilorin City Centre",
    "coordinates": {
      "latitude": 8.4966,
      "longitude": 4.5477
    }
  },
  "availableSeats": 3,
  "pricePerSeat": 500,
  "vehicleId": "1124c948-60cc-4754-84db-581e0ac97dba",
  "waitTimeMinutes": 10,
  "notes": "AC available",
  "pickupPoints": [
    {
      "name": "Faculty of Engineering Gate",
      "location": {
        "address": "Faculty of Engineering, UniLorin",
        "coordinates": {
          "latitude": 8.4812,
          "longitude": 4.5430
        }
      },
      "estimatedTime": "08:05",
      "orderIndex": 0
    }
  ]
}
```

**Field Rules**

| Field | Required | Notes |
|-------|----------|-------|
| `departureDate` | ✅ | `YYYY-MM-DD`, must be in the future |
| `departureTime` | ✅ | `HH:MM` (24-hour) |
| `startLocation` | ✅ | Location object with `latitude`/`longitude` |
| `endLocation` | ✅ | Location object with `latitude`/`longitude` |
| `availableSeats` | ✅ | 1–7 |
| `pricePerSeat` | ✅ | 100–5000 (NGN) |
| `vehicleId` | ❌ | UUID of vehicle to use. Omit to use primary vehicle |
| `waitTimeMinutes` | ❌ | 5–15 minutes (default: 10) |
| `notes` | ❌ | Max 500 chars |
| `pickupPoints` | ❌ | Array, max 5 items |
| `isRecurring` | ❌ | `false` by default |
| `recurringDays` | If recurring | Array of integers, 0=Sunday, 6=Saturday |
| `recurringEndDate` | If recurring | `YYYY-MM-DD` |

**Response `201`**

```json
{
  "success": true,
  "message": "Ride offer created successfully",
  "data": {
    "ride": {
      "rideId": "c4995957-0601-4b67-99b0-cb42b0d4d443",
      "driverId": "5b6ffaf1-d713-470a-b5e0-742169cb5c00",
      "vehicleId": "1124c948-60cc-4754-84db-581e0ac97dba",
      "departureDate": "2026-03-01",
      "departureTime": "08:00",
      "route": {
        "startLocation": {
          "address": "University of Ilorin Main Gate",
          "coordinates": { "latitude": 8.4799, "longitude": 4.5418 }
        },
        "endLocation": {
          "address": "Ilorin City Centre",
          "coordinates": { "latitude": 8.4966, "longitude": 4.5477 }
        },
        "distance": 3.5,
        "estimatedDuration": 9,
        "polyline": "ek_hHl{mDwBwCoBuBmAmAk@k@"
      },
      "pickupPoints": [],
      "availableSeats": 3,
      "totalSeats": 3,
      "bookedSeats": 0,
      "pricePerSeat": 500,
      "waitTime": 10,
      "status": "active",
      "isRecurring": false,
      "driver": {
        "userId": "5b6ffaf1-d713-470a-b5e0-742169cb5c00",
        "firstName": "Test",
        "lastName": "Driver",
        "averageRating": 4.7,
        "profilePhoto": null
      },
      "vehicle": {
        "vehicleId": "1124c948-60cc-4754-84db-581e0ac97dba",
        "make": "Toyota",
        "model": "Corolla",
        "color": "White",
        "plateNumber": "KWL-123-AB",
        "capacity": 4
      },
      "createdAt": "2026-02-28T19:16:22.000Z",
      "updatedAt": "2026-02-28T19:16:22.000Z"
    },
    "recurringRides": null
  }
}
```

**route.polyline** is a [Polyline6](https://developers.google.com/maps/documentation/utilities/polylinealgorithm)-encoded string. Use a polyline decoder library (e.g. `@mapbox/polyline`) to convert it to a list of `[lat, lng]` coordinates for map rendering.

**Error Codes:** `DRIVER_NOT_VERIFIED` (403), `VEHICLE_NOT_FOUND` (400), `RIDE_TIME_CONFLICT` (409), `DEPARTURE_IN_PAST` (400)

---

### GET /rides/match

Get rides matching the authenticated user's saved preferences.

**Auth required.**

---

### GET /rides/suggestions

Get ride suggestions based on ride history.

**Auth required.**

---

### GET /rides/my-rides

Get rides created by the authenticated user (driver only).

**Auth required. Driver status required.**

---

### GET /rides/{rideId}

Get details for a specific ride. **No auth required.**

**Response `200`** — returns full `Ride` object.

---

### PUT /rides/{rideId}

Update a ride. Driver ownership required.

**Auth required.**

**Request Body** (all optional)

```json
{
  "departureTime": "09:00",
  "availableSeats": 2,
  "pricePerSeat": 600,
  "waitTimeMinutes": 5,
  "notes": "Updated note"
}
```

To cancel via update:

```json
{
  "status": "cancelled",
  "cancellationReason": "Vehicle breakdown"
}
```

---

### POST /rides/{rideId}/cancel

Cancel a ride. Driver ownership required.

**Auth required.** No request body.

---

### POST /rides/{rideId}/start

Mark a ride as started. Driver ownership required.

**Auth required.** No request body.

---

### POST /rides/{rideId}/complete

Mark a ride as completed. Driver ownership required.

**Auth required.** No request body.

---

### GET /rides/{rideId}/pickup-points

Get all pickup points for a ride.

**Auth required.**

---

### POST /rides/{rideId}/pickup-points

Add a pickup point to a ride. Driver ownership required.

**Auth required.**

**Request Body**

```json
{
  "name": "Faculty of Engineering Gate",
  "location": {
    "address": "Faculty of Engineering, UniLorin",
    "coordinates": { "latitude": 8.4812, "longitude": 4.5430 }
  },
  "estimatedTime": "08:05"
}
```

---

### PUT /rides/{rideId}/pickup-points/reorder

Reorder pickup points. Driver ownership required.

**Auth required.**

**Request Body**

```json
{
  "order": ["pickup-point-uuid-1", "pickup-point-uuid-2"]
}
```

---

### DELETE /rides/{rideId}/pickup-points/{pickupPointId}

Remove a pickup point. Driver ownership required.

**Auth required.**

---

### GET /rides/{rideId}/bookings

Get all bookings on a ride. Driver ownership required.

**Auth required.**

---

### GET /rides/{rideId}/passengers

Get all confirmed passengers for a ride. Driver ownership required.

**Auth required.**

---

### POST /rides/recurring

Create a recurring ride schedule. Driver status required.

**Auth required.**

Same body as `POST /rides` with `isRecurring: true`, `recurringDays`, and `recurringEndDate`.

---

### GET /rides/recurring/my-schedules

Get the authenticated driver's recurring schedules.

**Auth required. Driver status required.**

---

### POST /rides/recurring/{scheduleId}/cancel

Cancel a recurring schedule. Driver ownership required.

**Auth required.**

---

## Booking Endpoints

### POST /bookings

Book a seat on a ride. Requires **verified email**.

Rate limited: 10 req/15 min.

**Auth required.**

**Request Body**

```json
{
  "rideId": "c4995957-0601-4b67-99b0-cb42b0d4d443",
  "pickupPointId": null,
  "seats": 1,
  "notes": "I'll be wearing a red shirt",
  "paymentMethod": "cash"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `rideId` | ✅ | UUID of the ride to book |
| `pickupPointId` | ❌ | UUID of a pickup point on this ride |
| `seats` | ❌ | 1–4 (default: 1) |
| `notes` | ❌ | Message to driver, max 500 chars |
| `paymentMethod` | ❌ | Only `cash` supported in Phase 1 |

**Response `201`**

```json
{
  "data": {
    "booking": {
      "bookingId": "abc123-...",
      "rideId": "c4995957-...",
      "passengerId": "5b6ffaf1-...",
      "seats": 1,
      "totalAmount": 500,
      "paymentMethod": "cash",
      "paymentStatus": "pending",
      "status": "pending",
      "verificationCode": "847291",
      "createdAt": "2026-03-01T07:30:00.000Z"
    }
  }
}
```

> **Important:** Save the `verificationCode`. The passenger shows this to the driver to confirm boarding. It is a 6-digit code.

**Error Codes:** `ALREADY_BOOKED` (409), `CANNOT_BOOK_OWN_RIDE` (403), `NO_SEATS_AVAILABLE` (400), `RIDE_NOT_FOUND` (404)

---

### GET /bookings

Get the authenticated user's own bookings.

**Auth required.**

---

### GET /bookings/upcoming

Get upcoming (future) bookings.

**Auth required.**

---

### GET /bookings/past

Get completed past bookings.

**Auth required.**

---

### GET /bookings/statistics

Get booking stats (total, completed, cancelled, etc.).

**Auth required.**

---

### GET /bookings/{bookingId}

Get a specific booking.

**Auth required.**

---

### POST /bookings/{bookingId}/cancel

Cancel a booking.

**Auth required.** No request body.

**Error Codes:** `CANCELLATION_NOT_ALLOWED` (400) if past the cancellation deadline

---

### GET /bookings/{bookingId}/verification

Get the 6-digit verification code for a booking. Passenger use only.

**Auth required.**

**Response `200`**

```json
{
  "data": {
    "verificationCode": "847291",
    "expiresAt": "2026-03-01T09:00:00.000Z"
  }
}
```

---

### POST /bookings/{bookingId}/confirm

Driver confirms a specific booking.

**Auth required. Driver ownership of ride required.**

---

### POST /bookings/{bookingId}/verify

Driver verifies the passenger's 6-digit code when they board.

**Auth required. Driver ownership of ride required.**

**Request Body**

```json
{ "verificationCode": "847291" }
```

**Error Codes:** `INVALID_PASSENGER_CODE` (400)

---

### POST /bookings/{bookingId}/start

Driver marks a booking as in-progress (passenger on board).

**Auth required. Driver ownership of ride required.**

---

### POST /bookings/{bookingId}/complete

Driver marks a booking as complete and confirms cash payment received.

**Auth required. Driver ownership of ride required.**

**Request Body**

```json
{
  "cashReceived": true,
  "actualAmount": 500
}
```

---

### POST /bookings/{bookingId}/no-show

Driver marks a passenger as no-show.

**Auth required. Driver ownership of ride required.**

---

## Rating Endpoints

Ratings can only be submitted after a booking is completed.

### POST /ratings

Submit a rating. Requires **verified email**.

**Auth required.**

**Request Body**

```json
{
  "bookingId": "abc123-...",
  "score": 5,
  "comment": "Very punctual and friendly driver",
  "tags": ["punctual", "friendly", "clean_car"]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `bookingId` | ✅ | Must be a completed booking |
| `score` | ✅ | Integer 1–5 |
| `comment` | ❌ | Max 500 chars |
| `tags` | ❌ | Max 5 items. Options: `punctual`, `friendly`, `clean_car`, `safe_driver`, `good_music` |

**Error Codes:** `ALREADY_RATED` (409), `BOOKING_NOT_COMPLETED` (400)

---

### GET /ratings/given

Get all ratings the user has given.

**Auth required.**

---

### GET /ratings/received

Get all ratings the user has received.

**Auth required.**

---

### GET /ratings/analytics

Get rating analytics (average score, score distribution).

**Auth required.**

---

### GET /ratings/unrated

Get completed bookings that haven't been rated yet.

**Auth required.**

---

### GET /ratings/user/{userId}

Get all ratings for a specific user.

**Auth required.**

---

### GET /ratings/reliability/{userId}

Get reliability score for a specific user.

**Auth required.**

---

### PUT /ratings/{ratingId}

Update a rating.

**Auth required.**

**Request Body**

```json
{
  "score": 4,
  "comment": "Updated comment"
}
```

---

### POST /ratings/{ratingId}/report

Report an inappropriate rating.

**Auth required.**

**Request Body**

```json
{ "reason": "Contains offensive language" }
```

---

## Notification Endpoints

### GET /notifications

Get all notifications for the authenticated user.

**Auth required.**

---

### GET /notifications/unread-count

Get count of unread notifications.

**Auth required.**

**Response `200`**

```json
{ "data": { "count": 3 } }
```

---

### PATCH /notifications/read-all

Mark all notifications as read.

**Auth required.**

---

### PATCH /notifications/{notificationId}/read

Mark a specific notification as read.

**Auth required.**

---

### DELETE /notifications/{notificationId}

Delete a notification.

**Auth required.**

---

### GET /notifications/preferences

Get notification channel preferences.

**Auth required.**

**Response `200`**

```json
{
  "data": {
    "preferences": {
      "email": {
        "booking": true,
        "ride": true,
        "payment": true,
        "rating": true,
        "account": true,
        "promotional": false
      },
      "push": {
        "booking": true,
        "ride": true,
        "payment": true,
        "rating": true,
        "account": true,
        "promotional": false
      },
      "sms": {
        "booking": true,
        "ride": true,
        "safety": true
      }
    }
  }
}
```

---

### PUT /notifications/preferences

Update notification preferences.

**Auth required.** Same shape as the response above.

---

### GET /notifications/push/vapid-key

Get the VAPID public key needed to subscribe to Web Push notifications.

**Auth required.**

**Response `200`**

```json
{ "data": { "publicKey": "BOxVL3Ws..." } }
```

---

### POST /notifications/push/subscribe

Register a Web Push subscription (for PWA / service worker).

**Auth required.**

**Request Body**

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "BNcRdreALRFXTkOOUHK...",
    "auth": "tBHItJI5svbpez7KI4..."
  }
}
```

This is the object returned by the browser's `PushManager.subscribe()` call. Pass it directly.

---

### POST /notifications/push/unsubscribe

Remove a Web Push subscription.

**Auth required.**

**Request Body**

```json
{ "endpoint": "https://fcm.googleapis.com/fcm/send/..." }
```

---

## Safety Endpoints

### POST /safety/sos

Trigger an SOS alert. Rate limited: 5 req/15 min.

**Auth required.**

**Request Body**

```json
{
  "location": {
    "latitude": 8.4799,
    "longitude": 4.5418
  },
  "rideId": "c4995957-...",
  "message": "I feel unsafe"
}
```

All fields are optional — sending an empty body `{}` will still trigger an alert.

---

### GET /safety/sos

Get the user's own SOS alert history.

**Auth required.**

---

### POST /safety/sos/{alertId}/resolve

Mark an SOS alert as resolved.

**Auth required.**

---

### POST /safety/location/share

Start sharing your location with a shareable link.

**Auth required.**

**Request Body**

```json
{
  "rideId": "c4995957-...",
  "duration": 60
}
```

`duration` is in minutes (optional).

**Response `200`**

```json
{
  "data": {
    "shareToken": "abc123xyz",
    "shareUrl": "https://psride.ng/track/abc123xyz",
    "expiresAt": "2026-03-01T10:00:00.000Z"
  }
}
```

---

### GET /safety/location/{shareToken}

Get a shared location. **No auth required** (public link).

---

### POST /safety/location/stop

Stop sharing location.

**Auth required.** No request body.

---

### PUT /safety/location

Update current location coordinates.

**Auth required.**

**Request Body**

```json
{
  "latitude": 8.4799,
  "longitude": 4.5418
}
```

---

### POST /safety/incidents

Report an incident.

**Auth required.**

**Request Body**

```json
{
  "rideId": "c4995957-...",
  "type": "unsafe_driving",
  "description": "Driver was driving dangerously"
}
```

---

### GET /safety/incidents

Get the user's incident reports.

**Auth required.**

---

## Report Endpoints

Driver-facing reports. **Driver status required** on all endpoints.

### GET /reports/driver/cash

Get driver cash collection report.

### GET /reports/driver/earnings

Get driver earnings summary.

### GET /reports/driver/summary

Get overall driver performance summary.

---

## Admin Endpoints

All admin endpoints require **admin role**. Regular users will receive `403 FORBIDDEN`.

### GET /admin/users

List all users with filters.

**Query Parameters:** `query`, `role`, `isDriver`, `status`, `page`, `limit`, `sortBy`, `sortOrder`

### GET /admin/users/{userId}

Get a specific user's full profile.

### PUT /admin/users/{userId}

Update any user's data.

### POST /admin/users/{userId}/verify-driver

Approve or reject a driver application.

**Request Body**

```json
{
  "approved": true
}
```

Or to reject:

```json
{
  "approved": false,
  "rejectionReason": "License image is not clear"
}
```

### POST /admin/users/{userId}/suspend

Suspend a user account.

**Request Body**

```json
{ "reason": "Repeated policy violations" }
```

### POST /admin/notifications/send

Send a notification to a specific user.

**Request Body**

```json
{
  "userId": "5b6ffaf1-...",
  "title": "Driver Application Update",
  "message": "Your driver application has been approved.",
  "type": "account"
}
```

### POST /admin/notifications/send-bulk

Send a notification to multiple users.

**Request Body**

```json
{
  "title": "Scheduled Maintenance",
  "message": "The app will be down for maintenance from 2am–4am.",
  "type": "system",
  "filters": { "role": "student" }
}
```

### GET /admin/safety/sos

View all SOS alerts.

### GET /admin/safety/incidents

View all incident reports.

### POST /admin/safety/incidents/{incidentId}/resolve

Resolve an incident.

### GET /admin/reports/cash-collection

**Query Parameters:** `date` (YYYY-MM-DD), `startDate`, `endDate`

### GET /admin/reports/statistics

Platform-wide statistics.

### GET /admin/reports/driver-leaderboard

Top drivers by completed rides and ratings.

### GET /admin/reports/user-growth

User registration growth over time.

---

## Common Workflows

### 1. Register as a Driver

```
1. POST /auth/register                   → create account
2. Check email → POST /auth/verify-email → verify email
3. POST /auth/login                      → get token
4. POST /users/driver/register           → submit license + vehicle
5. Wait for admin approval
6. Admin: POST /admin/users/{userId}/verify-driver { approved: true }
7. Driver can now POST /rides
```

---

### 2. Create and Manage a Ride (Driver)

```
1. POST /auth/login                        → get token
2. POST /rides                             → create ride (Mapbox calculates route)
3. GET /rides/{rideId}/bookings            → see who booked
4. POST /rides/{rideId}/start              → mark ride as started
5. For each passenger:
   POST /bookings/{bookingId}/verify       → verify 6-digit code
   POST /bookings/{bookingId}/start        → passenger on board
   POST /bookings/{bookingId}/complete     → ride done, cash received
6. POST /rides/{rideId}/complete           → mark ride as complete
```

---

### 3. Book a Ride (Passenger)

```
1. POST /auth/login                         → get token
2. GET /rides/search?date=...&seats=1       → find rides
3. POST /bookings { rideId, seats: 1 }      → book a seat
4. Save verificationCode from response
5. On ride day: show verificationCode to driver
6. POST /ratings { bookingId, score: 5 }    → rate after completion
```

---

### 4. Cash Payment Verification Flow

This is the Phase 1 payment flow. No online payment — all cash in person.

```
Passenger                          Driver
    │                                │
    │── Books ride ──────────────────▶│
    │◀─ Gets verificationCode "847291"│
    │                                │
    │  (Ride day — passenger boards)  │
    │                                │
    │── Shows 6-digit code ──────────▶│
    │                          Calls POST /bookings/{id}/verify
    │                          with { verificationCode: "847291" }
    │                                │
    │                          Passenger pays cash
    │                                │
    │                          Calls POST /bookings/{id}/complete
    │                          with { cashReceived: true, actualAmount: 500 }
    │                                │
    │── Can now rate driver ──────────▶│
```

---

### 5. Web Push Notification Setup (PWA)

> **Note:** Web Push requires VAPID keys to be configured on the server (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_MAILTO` env vars). `GET /notifications/push/vapid-key` will return `null` if they are not set.

```javascript
// 1. Get VAPID public key
const { data: { publicKey } } = await fetch('/notifications/push/vapid-key', {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());

// 2. Subscribe via service worker
const registration = await navigator.serviceWorker.ready;
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: publicKey
});

// 3. Send subscription to backend
await fetch('/notifications/push/subscribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    endpoint: subscription.endpoint,
    keys: {
      p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
      auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))))
    }
  })
});
```

---

### 6. Decode Route Polyline for Map Display

The `route.polyline` field on a ride uses [Polyline6](https://developers.google.com/maps/documentation/utilities/polylinealgorithm) encoding.

```javascript
import polyline from '@mapbox/polyline';

const coordinates = polyline.decode(ride.route.polyline, 6);
// Returns [[lat, lng], [lat, lng], ...]

// For Mapbox GL JS:
const geojson = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: coordinates.map(([lat, lng]) => [lng, lat])
  }
};
```

---

## Changelog

### v1.2.0 — March 1, 2026
- Added [Environments](#environments) section with dev / staging / production URLs
- Added VAPID keys note to Web Push setup workflow
- Added this Changelog section
- Updated version to reflect production hardening work (staging + production Terraform environments, DynamoDB PITR, ENCRYPTION_KEY and VAPID env vars wired into Lambda)

### v1.1.0 — February 28, 2026
- **Mapbox integration:** `POST /rides` now auto-calculates `route.distance`, `route.estimatedDuration`, and `route.polyline` via Mapbox Directions API v5 (driving profile). Falls back to Haversine if Mapbox is unavailable — `route.polyline` will be `null` in that case.
- Added `RouteInfo` schema documentation with all three fields
- Added `route.polyline` decode workflow (section 6)
- Added `vehicleId` field to `POST /rides` request body
- Updated `Ride` response object to include nested `route`, `driver`, and `vehicle` objects
- Added `GET /notifications/push/vapid-key` and `POST /notifications/push/subscribe` / `unsubscribe` endpoints
- Expanded error code reference

### v1.0.0 — February 27, 2026
- Initial release covering all 104 endpoints across 9 resource groups

If `route.polyline` is `null`, Mapbox was unavailable and you should draw a straight line between `route.startLocation.coordinates` and `route.endLocation.coordinates` as a fallback.
