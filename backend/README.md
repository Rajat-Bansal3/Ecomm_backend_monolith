# E-commerce Backend

A robust e-commerce backend built with Node.js, Express, TypeScript, MongoDB, and Redis. Features include role-based access control, secure authentication, product management, cart functionality, and order processing.

## Features

- Role-based access control (Admin and User roles)
- JWT-based authentication with refresh tokens
- Product management with caching
- Shopping cart functionality
- Order processing
- Rate limiting
- Input validation
- Error handling
- TypeScript support
- MongoDB for data persistence
- Redis for caching and token blacklisting

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Redis
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example` and update the values
4. Build the TypeScript code:
   ```bash
   npm run build
   ```
5. Start the server:
   ```bash
   npm start
   ```

For development:
```bash
npm run dev
```

## API Endpoints

### Authentication
- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user
- POST /api/auth/refresh-token - Refresh access token
- POST /api/auth/logout - Logout user

### Products
- GET /api/products - Get all products
- GET /api/products/:id - Get single product
- POST /api/products - Create product (Admin only)
- PUT /api/products/:id - Update product (Admin only)
- DELETE /api/products/:id - Delete product (Admin only)

### Cart
- GET /api/cart - Get user's cart
- POST /api/cart/add - Add item to cart
- PUT /api/cart/update - Update cart item
- DELETE /api/cart/remove/:productId - Remove item from cart
- DELETE /api/cart/clear - Clear cart

### Orders
- POST /api/orders - Create order
- GET /api/orders - Get user's orders
- GET /api/orders/:id - Get single order
- PUT /api/orders/:id/status - Update order status (Admin only)
- POST /api/orders/:id/cancel - Cancel order

## Environment Variables

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ecommerce
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_refresh_token_secret_here
JWT_REFRESH_EXPIRES_IN=30d
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=http://localhost:3000
```

## Error Handling

The API uses a centralized error handling mechanism with proper HTTP status codes and consistent error responses.

## Caching

Redis is used for:
- Product caching
- Cart caching
- Order caching
- Token blacklisting

## Security Features

- JWT-based authentication
- Password hashing
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation
- Role-based access control

## License

MIT 