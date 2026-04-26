import { configDotenv } from "dotenv";
configDotenv({ path: "./.env" })
import http from "node:http"
import path from "node:path";
import express from "express";
import { Server } from "socket.io"
import { stat } from "node:fs";

const checkbox_size = 20;
const state = {
  checkboxes: new Array(checkbox_size).fill(false)
}



function createApp() {
  const port = process.env.port ?? 8080;
  const app = express()
  const server = http.createServer(app)
  const io = new Server();
  io.attach(server)

  io.on("connection", (socket) => {
    console.log("socket connected", socket.id)
    socket.on("client:checkbox:change", (data) => {
      console.log(`socket-${socket.id}:client:checkbox:change`, data)
      io.emit("server:checkbox:change", data)
      //saving state
      state.checkboxes[data.index] = data.checked
    })
  })


  app.use(express.static("public")) //this works according to relative to cwd
  // app.use(express.static(path.resolve("./public"))) //converts it to absolute path, ensure correct path

  app.get("/health", (req, res) => {
    res.send("System Status - GOOD")
  })

  //fetching state
  app.get("/checkboxes-state", (req, res) => {
    return res.status(200).json({ checkboxes: state.checkboxes })
  })

  server.listen(port, () => {
    console.log(`server is listening on http://localhost:${port}`)
  })
}

createApp()