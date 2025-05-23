# OpenScribe License Server

A Node.js/Express license server for OpenScribe that handles user authentication, subscription management, and machine licensing.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- SQLite3
- Stripe account (for payment processing)

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Edit .env with your configuration
   nano .env
   ```

3. **Set up Stripe**
   - Get your keys from https://dashboard.stripe.com/apikeys
   - Create products and pricing in Stripe dashboard
   - Add webhook endpoint: `https://yourdomain.com/subscriptions/webhook`

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | `whsec_...` |
| `DATABASE_PATH` | SQLite database path | `./data/license.db` |
| `CORS_ORIGINS` | Allowed origins | `http://localhost:3000` |

### Stripe Setup

1. **Create Products**
   - Basic Plan: $9.99/month (2 machines)
   - Pro Plan: $19.99/month (5 machines)

2. **Configure Webhooks**
   Add these events to your webhook:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

## 📋 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/validate` - Token validation
- `POST /auth/logout` - User logout

### Subscriptions
- `GET /subscriptions/check` - Check subscription status
- `POST /subscriptions/create-checkout` - Create Stripe checkout
- `POST /subscriptions/billing-portal` - Access billing portal
- `POST /subscriptions/webhook` - Stripe webhook handler

### Machines
- `POST /machines/register` - Register/update machine
- `POST /machines/deregister` - Deregister machine
- `GET /machines/:userId` - List user machines
- `POST /machines/validate` - Validate machine access

### Health
- `GET /health` - Server health check

## 🗄️ Database Schema

The server uses SQLite with the following tables:

- **users** - User accounts and Stripe customer info
- **subscriptions** - Subscription status and limits
- **machines** - Registered machines per user
- **license_tokens** - Offline validation tokens
- **audit_log** - Action logging for security

## 🔒 Security Features

- JWT token authentication
- Password hashing with bcrypt
- Rate limiting protection
- CORS configuration
- SQL injection prevention
- Audit logging
- Helmet security headers

## 🚀 Deployment

### Using PM2 (Recommended)
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start src/index.js --name "openscribe-license"

# Save PM2 configuration
pm2 save
pm2 startup
```

### Using Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Variables for Production
```bash
NODE_ENV=production
JWT_SECRET=your-very-secure-secret-key
STRIPE_SECRET_KEY=sk_live_your_live_key
DATABASE_PATH=/data/license.db
CORS_ORIGINS=https://yourapp.com
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3001/health
```

### Database Monitoring
The server automatically creates indexes and logs database operations. Monitor the logs for performance issues.

### Stripe Webhook Monitoring
Check Stripe dashboard for webhook delivery status and failed events.

## 🛠️ Development

### Running Tests
```bash
npm test  # (tests to be implemented)
```

### Database Migrations
The server automatically creates tables on startup. For schema changes, modify `src/database.js`.

### Adding New Routes
1. Create route file in `src/routes/`
2. Add authentication middleware if needed
3. Register route in `src/index.js`

## 🤝 Integration with OpenScribe App

The license server is designed to work with the OpenScribe Electron app. Configure the app to point to your server:

```javascript
// In your Electron app's environment config
OPENSCRIBE_LICENSE_SERVER_URL=https://your-license-server.com
```

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the logs: `tail -f logs/license-server.log`
2. Verify Stripe webhook configuration
3. Test database connectivity
4. Check CORS settings for client requests

## 🔄 Backup

Regular database backups are recommended:
```bash
# Backup SQLite database
cp ./data/license.db ./backups/license-$(date +%Y%m%d).db
``` 