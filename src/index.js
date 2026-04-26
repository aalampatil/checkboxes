import { configDotenv } from "dotenv";
configDotenv({ path: "./.env" })
import http from "node:http"
import path from "node:path";
import express from "express";
import { Server } from "socket.io"
import { publisher, subscriber, redis } from "../redis-connection.js";
import { channel } from "node:diagnostics_channel";
import { stat } from "node:fs";

const checkbox_size = 20;
const checkbox_state_key = "checkbox-state"

const setCheckBoxState = async (state) => {
  return await redis.set(checkbox_state_key, JSON.stringify(state))
}

const getCheckBoxState = async () => {
  const data = await redis.get(checkbox_state_key)
  return data ? JSON.parse(data) : null
}

const getOrCreateState = async () => {
  let state = await getCheckBoxState()
  if (!state) {
    state = new Array(checkbox_size).fill(false)
    setCheckBoxState(state)
  }
  return state
}

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
      const state = await getOrCreateState()
      state[data.index] = data.checked;
      await setCheckBoxState(state)
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
    const state = await getOrCreateState();
    return res.json({ checkboxes: state });
  })

  server.listen(port, () => {
    console.log(`server is listening on http://localhost:${port}`)
  })
}

createApp()