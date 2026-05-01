# M-Checkboxes

A lightweight real-time checkbox synchronization application built with **Node.js**, **Express**, **Socket.IO**, and **Valkey (Redis-compatible)**. This project demonstrates how to manage shared UI state across multiple clients using WebSockets and an in-memory data store.

---

## 🚀 Features

- 🔄 Real-time checkbox state synchronization across clients
- ⚡ WebSocket-based communication using Socket.IO
- 🧠 State persistence with Valkey (Redis-compatible)
- 🍪 Cookie parsing support
- 🌐 Simple static frontend (HTML pages)
- 🐳 Docker support for running Valkey

---

## 📁 Project Structure

```
.
├── public/                # Static frontend files
│   ├── index.html
│   └── login.html
├── src/                   # Backend source code
│   └── index.js
├── redis-connection.js    # Valkey/Redis connection setup
├── .env                   # Environment variables (development)
├── .env.production        # Environment variables (production)
├── docker-compose.yml     # Valkey container setup
├── package.json
└── README.md
```

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express
- **Realtime:** Socket.IO
- **Storage:** Valkey (Redis-compatible)
- **Environment Management:** dotenv
- **Containerization:** Docker

---

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd m-checkboxes
```

### 2. Install dependencies

```bash
npm install
```

---

## 🐳 Running Valkey (Redis)

This project uses **Valkey**, a Redis-compatible in-memory database.

Start it using Docker:

```docker-compose.yml
services:
  valkey:
    image: valkey/valkey
    ports:
      - 6379:6379

```

```bash
docker-compose up -d
```

This will expose Valkey on:

```
localhost:6379
```

---

## 🔑 Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
PORT=
CLIENT_ID=
CLIENT_SECRET=
REDIRECT_URI=
OIDC_BASE=
REDIS_HOST=localhost
REDIS_PORT=6379
```

You can also configure production variables in `.env.production`.

---

## ▶️ Running the Application

### Development mode (auto-restart)

```bash
npm run dev
```

### Production mode

```bash
npm start
```

---

## 🌐 Usage

1. Start the backend server
2. Open `public/index.html` in your browser
3. Open the same page in multiple tabs or devices
4. Interact with checkboxes and see real-time updates across all clients

---

## 🔌 How It Works

- The frontend connects to the server via **Socket.IO**
- When a checkbox state changes:
  - The update is emitted to the server
  - The server stores the state in **Valkey**
  - The server broadcasts the updated state to all connected clients

- This ensures all users see consistent, real-time UI state

---

## 📦 Scripts

```json
"scripts": {
  "dev": "node --watch src/index.js",
  "start": "node src/index.js"
}
```

---

## 🧪 Future Improvements

- Add authentication system (login/session handling)
- Persist checkbox groups per user
- Add UI framework (React/Vue)
- Deploy with Docker Compose (full stack)
- Add unit and integration tests

---

## 📄 License

This project is licensed under the ISC License.

---

## 👤 Author

Your Name
GitHub: https://github.com/aalampatil

---

## 💡 Notes

- Valkey is used as a drop-in Redis replacement
- The app is intentionally minimal to showcase real-time synchronization concepts
- Suitable as a starter template for collaborative apps

---

## 🧠 Inspiration

This project is ideal for learning:

- WebSocket communication patterns
- Shared state synchronization
- Backend + frontend interaction in real-time systems

---

Happy coding! 🚀
