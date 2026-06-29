# Klinik Alfa Queue System

A simple queue-calling system with two screens:

- **Display screen** (`/`) - half-screen uploaded image + "Now Serving" panel with the last 3 calls, blinking + sound on a new call.
- **Doctor panel** (`/doctor.html`) - login, pick a room, type a queue number, Call / Recall.
- **Display settings** (`/admin.html`) - password-protected page to upload the image shown on the left half of the display screen.

Everything runs from one small Node.js server so the display (e.g. a TV/mini-PC) and the doctor's computer can be different devices on the same Wi-Fi/LAN.

## Run it

```
npm install
npm start
```

The console prints the URLs to open, e.g.:

```
Display:      http://localhost:4000/
Doctor panel: http://localhost:4000/doctor.html
Admin upload: http://localhost:4000/admin.html

From other devices on the same network, use:
  http://<your-lan-ip>:4000/
```

Open the **Display** URL on the TV/monitor browser, and the **Doctor panel** URL on each doctor/counter/dispensary computer, using the LAN address printed in the console (not `localhost`) if they're different machines.

## Default credentials

Edit [config.js](config.js) to change any of these.

- Doctor login (shared by all rooms): `clinic` / `clinic123`
- Admin (image upload) password: `admin123`
- Rooms available at login: Room 1-4, Counter, Dispensary

## How it works

- The doctor logs in, picks their room, types a queue number, and clicks **Call**. The number appears at the top of the display screen's list, blinks, and plays a chime for ~3 seconds.
- **Recall** cancels that room's last call - it disappears from the display (use this if the wrong number was called).
- The display always shows the 4 most recently called numbers across all rooms, newest on top.
- State (queue history) lives in server memory only - it resets when the server restarts. That's expected for a daily-reset clinic queue.

## Display screen sound

Browsers block audio until a user interacts with the page. On first load, the display screen shows a "Tap anywhere to start the display" overlay - tap it once after opening the page on the TV/kiosk device, and the chime will work for every call after that for the rest of the browser session.
