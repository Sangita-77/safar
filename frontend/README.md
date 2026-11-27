# Frontend

The frontend contains two apps:

- `mobile/` is the Expo app for Android and iOS.
- The frontend root contains the existing browser app.

## Mobile app (Expo)

Set `EXPO_PUBLIC_BACKEND_URL` in `mobile/.env` to the backend origin before
starting. Use `http://localhost:7200` for web, `http://10.0.2.2:7200` for an
Android emulator, or your computer's LAN address for a physical device. Enable
Clerk's Native API for the Clerk application to sign in on mobile.

From this directory, run:

```bash
cd mobile
npx expo start -c
```

Scan the QR code with Expo Go to open the app on a device, or press `a` to
launch it in an Android emulator. Press `w` to open the web version.

## Browser app

From this directory, run:

```bash
npm start
```

This starts the existing browser app at [http://localhost:3000](http://localhost:3000).
