module.exports = {
  port: process.env.PORT || 4000,

  // Rooms selectable at doctor login
  rooms: [
    'Room 1',
    'Room 2',
    'Room 3',
    'Room 4',
    'Counter',
    'Dispensary',
  ],

  // Shared login used by any room - doctor picks the room separately at login
  doctorCredentials: {
    username: 'clinic',
    password: 'clinic123',
  },

  // Separate password to access the display-image upload page
  adminPassword: 'admin123',

  // How many rows of call history the display screen shows
  maxHistoryRows: 4,

  // Optional - if both are set, queue history/room status survive restarts
  // by persisting to Upstash Redis (free tier). If unset, the app just runs
  // in-memory only (fine for local testing).
  upstash: {
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  },
};
