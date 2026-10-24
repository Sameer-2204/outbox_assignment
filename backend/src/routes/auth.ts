import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { config } from '../config';
import prisma from '../lib/prisma';
import { generateToken } from '../middleware/auth';

const router = Router();

// Configure Passport Google Strategy
if (config.google.clientId && config.google.clientSecret) {
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

          // Upsert user in DB
          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            update: { email, name, avatar },
            create: {
              googleId: profile.id,
              email,
              name,
              avatar,
            },
          });

          done(null, user as Express.User);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user: Express.User, done) => {
  done(null, user);
});

// Google OAuth initiation
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${config.frontendUrl}/login?error=auth_failed`,
    session: false,
  }),
  (req: Request, res: Response) => {
    const user = req.user as { id: string; email: string; name: string; avatar?: string };
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    });

    // Redirect to frontend with token
    res.redirect(`${config.frontendUrl}/auth/callback?token=${token}`);
  }
);

export default router;
