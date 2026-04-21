import { configDotenv } from "dotenv"
configDotenv({ path: './.env' })
import express from "express"
import { createServer } from "node:http"
import { Server } from "socket.io"

const app = express()
const port = process.env.PORT;

const server = createServer(app);
app.use(express.static("public"))
const io = new Server(server, {
  cors: { origin: "*" }
});

const TOTAL = 10000;
const winningIndex = Math.floor(Math.random() * TOTAL);

let gameOver = false;
let clicked = new Set();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);


  // Send initial state
  socket.emit("init", {
    total: TOTAL,
    clicked: Array.from(clicked),
    gameOver
  });

  socket.on("click", (index) => {
    if (gameOver) return;
    if (clicked.has(index)) return;

    clicked.add(index);

    if (index === winningIndex) {
      gameOver = true;

      io.emit("winner", {
        index,
        code: process.env.Code
      });
    } else {
      io.emit("miss", { index });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});