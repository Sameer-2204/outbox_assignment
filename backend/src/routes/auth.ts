import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { config } from '../config';
import prisma from '../lib/prisma';
import { generateToken } from '../middleware/auth';

const router = Router();

const googleConfigured = !!(config.google.clientId && config.google.clientSecret);

// Configure Passport Google Strategy only if credentials are present
if (googleConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: (error: Error | null, user?: Express.User) => void
      ) => {
        try {
          const email = profile.emails?.[0]?.value || '';
          const name = profile.displayName || '';
          const avatar = profile.photos?.[0]?.value || '';

          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            update: { email, name, avatar },
            create: { googleId: profile.id, email, name, avatar },
          });

          done(null, user as Express.User);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user: Express.User, done) => done(null, user));

// Guard middleware: returns 500 with a clear message if Google isn't configured
function requireGoogleConfig(req: Request, res: Response, next: NextFunction): void {
  if (!googleConfigured) {
    res.status(500).json({
      error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.',
    });
    return;
  }
  next();
}

// GET /auth/google — initiate OAuth flow
router.get('/google', requireGoogleConfig, (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
});

// GET /auth/google/callback — OAuth callback
router.get(
  '/google/callback',
  requireGoogleConfig,
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', {
      failureRedirect: `${config.frontendUrl}/login?error=auth_failed`,
      session: false,
    })(req, res, next);
  },
  (req: Request, res: Response) => {
    try {
      const user = req.user as { id: string; email: string; name: string; avatar?: string };
      if (!user) {
        res.redirect(`${config.frontendUrl}/login?error=no_user`);
        return;
      }
      const token = generateToken({
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      });
      res.redirect(`${config.frontendUrl}/auth/callback?token=${token}`);
    } catch (err) {
      console.error('[Auth] Callback error:', err);
      res.redirect(`${config.frontendUrl}/login?error=server_error`);
    }
  }
);

// GET /auth/me — check current token (useful for debugging)
router.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token' });
    return;
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(authHeader.substring(7), config.jwtSecret);
    res.json(decoded);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
