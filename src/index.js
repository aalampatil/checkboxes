import { configDotenv } from "dotenv";
configDotenv({ path: "./.env" })
import http from "node:http"
import path from "node:path";
import express from "express";
import { Server } from "socket.io"
import { publisher, subscriber, redis } from "../redis-connection.js";
import { channel } from "node:diagnostics_channel";

const checkbox_size = 20;
const checkbox_state_key = "checkbox-state"

async function createApp() {
  const port = process.env.PORT;
  console.log(port)
  const app = express()
  const server = http.createServer(app)
  const io = new Server();
  io.attach(server)

  await subscriber.subscribe("internal-server:checkbox:change")
  subscriber.on("message", (channel, message) => {
    if (channel === "internal-server:checkbox:change") {
      const { index, checked } = JSON.parse(message)
      io.emit("server:checkbox:change", { index, checked })
    }
  })

  //socket.io handler
  io.on("connection", (socket) => {
    console.log("socket connected", socket.id)
    socket.on("client:checkbox:change", async (data) => {
      console.log(`socket-${socket.id}:client:checkbox:change`, data)
      // io.emit("server:checkbox:change", data)
      // //saving state
      // state.checkboxes[data.index] = data.checked
      const existingState = await redis.get(checkbox_state_key)
      if (existingState) {
        const remoteData = JSON.parse(existingState);
        remoteData[data.index] = data.checked
        await redis.set(checkbox_state_key, JSON.stringify(remoteData))
      } else {
        await redis.set(checkbox_state_key, JSON.stringify(new Array(checkbox_size).fill(false)))
      }
      await publisher.publish("internal-server:checkbox:change", JSON.stringify(data))
    })
  })


  // app.use(express.static("public")) //this works according to relative to cwd
  app.use(express.static(path.resolve("./public"))) //converts it to absolute path, ensure correct path

  app.get("/health", (req, res) => {
    res.send("System Status - GOOD")
  })

  //fetching state
  app.get("/checkboxes-state", async (req, res) => {
    const existingState = await redis.get(checkbox_state_key)
    if (existingState) {
      const remoteData = JSON.parse(existingState)
      return res.json({ checkboxes: remoteData })
    }
    return res.json({ checkboxes: new Array(checkbox_size).fill(false) })
  })

  server.listen(port, () => {
    console.log(`server is listening on http://localhost:${port}`)
  })
}

createApp()