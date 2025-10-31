# PWcb Deployment Guide

## Prerequisites

- Node.js 14 or higher
- npm package manager
- (Optional) A reverse proxy like nginx for production

## Installation

1. Clone the repository:
```bash
git clone https://github.com/h412pj/PWcb.git
cd PWcb
```

2. Install dependencies:
```bash
npm install
```

3. Set environment variables (IMPORTANT for production):
```bash
export JWT_SECRET="your-secure-random-secret-here"
export PORT=3000
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The application will start on the specified PORT (default: 3000).

## First Time Setup

1. Access the application at http://localhost:3000
2. Login with default admin credentials:
   - Username: `admin`
   - Password: `admin123`
3. IMPORTANT: Change the admin password immediately!

## Security Considerations

### Production Deployment

1. **Set JWT_SECRET environment variable** - Never use the default secret in production
2. **Use HTTPS** - Deploy behind a reverse proxy with SSL/TLS
3. **Change default admin password** - The default credentials should be changed immediately
4. **Add rate limiting** - Consider using express-rate-limit middleware
5. **Database backup** - Regularly backup the pwcb.db file
6. **File permissions** - Ensure pwcb.db has appropriate file permissions

### Recommended nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Database

The application uses SQLite database stored in `pwcb.db` file. The database is automatically created on first run.

### Backup

```bash
# Create backup
cp pwcb.db pwcb.db.backup

# Restore from backup
cp pwcb.db.backup pwcb.db
```

## Troubleshooting

### Application won't start
- Check if port 3000 is already in use
- Verify Node.js version (14+)
- Check file permissions

### Can't login
- Verify database file exists and is writable
- Check browser console for errors
- Ensure JWT_SECRET is set consistently

### Items not appearing
- Check browser console for API errors
- Verify database integrity
- Check server logs

## Support

For issues and questions, please create an issue on GitHub.
