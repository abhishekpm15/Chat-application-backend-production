const express = require("express");
const bodyparser = require("body-parser");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
app.use(bodyparser.urlencoded({ extended: true }));
app.use(cors());
app.use(express.json());
const path = require("path");
require('dotenv').config();
mongoose
  .connect(
    `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tn0wwt0.mongodb.net/?retryWrites=true&w=majority`,
    {
      dbName: "Chat-applications",
    }
  )
  .then(() => {
    console.log("connected to db");
  })
  .catch((err) => {
    console.log(err);
  });

const User = new mongoose.Schema({
  id: String,
  email: String,
  name: String,
});

const UserFriends = new mongoose.Schema({
  id: String,
  friends: [
    {
      id: String,
      email: String,
      name: String,
    },
  ],
});

const Messages = new mongoose.Schema({
  sender_id: String,
  friends: [
    {
      id: String,
      messages: [
        {
          text: String,
          timestamps: {
            type: Date,
            default: Date.now,
          },
          sent: Boolean,
        },
      ],
    },
  ],
});

const model = mongoose.model("Users", User);
const model2 = mongoose.model("UserFriends", UserFriends);
const model3 = mongoose.model("Messages", Messages);

app.get("/", (req, res) => {
  res.send("Hello");
});

app.get("/get-friends/:user_id", (req, res) => {
  // console.log("request got");
  model2
    .find({ id: req.params.user_id })
    .then((result) => {
      if (result.length > 0) {
        // console.log("result");
        res.send(result[0].friends);
        // console.log(result[0].friends);
      } else {
        res.send(null);
      }
    })
    .catch((err) => {
      console.log(err);
    });
});

app.post("/add-friends", async (req, res) => {
  const userId = req.body.id;
  const newFriends = req.body.friends;
  console.log(userId, newFriends);

  try {
    const existingUser = await model2.findOne({ id: userId });

    if (existingUser) {
      console.log(req.body.friends.id);
      const findFriend = await model2.findOne({
        "friends.id": req.body.friends.id,
      });
      if (findFriend) {
        console.log("Friend already exists");
        res.send("Friend already in you list");
      } else {
        existingUser.friends.push(newFriends);
        await existingUser.save();
        console.log("Friends added to an existing user");
        res.status(201).json(existingUser);
      }
    } else {
      const newUser = new model2({
        id: userId,
        friends: [newFriends],
      });
      await newUser.save();
      console.log("New user created with friends");
      res.status(201).json(newUser);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/get-user/:user_name", (req, res) => {
  console.log(req.params.user_name);
  model
    .find({ email: req.params.user_name })
    .then((result) => {
      res.send(result);
      if (result.length > 0) {
        console.log("User found", result);
      } else {
        console.log("No user Found with such username");
      }
    })
    .catch((err) => {
      console.log(err);
    });
});

app.post("/register/:user_id", (req, res) => {
  console.log(req.body);
  const searchId = req.params.user_id;
  console.log(searchId);
  model
    .find({ id: searchId })
    .then((existingUsers) => {
      console.log("Existing Users", existingUsers);
      if (existingUsers.length > 0) {
        console.log("User already exists");
        res.status(409).json({ message: "User already exists" });
      } else {
        const data = new model(req.body);
        data
          .save()
          .then((savedUser) => {
            console.log("Saved User", savedUser);
            res.status(201).json(savedUser);
          })
          .catch((err) => {
            console.log(err);
            res.status(500).json({ message: "Internal server error" });
          });
      }
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "Internal server error" });
    });
});

app.post("/message/send-message", async (req, res) => {
  console.log(req.body);
  try {
    const senderResult = await model3.findOne({
      sender_id: req.body.sender_id,
    });

    if (senderResult) {
      console.log("inside senderResult");

      const friendResult = await model3.findOne({
        "friends.id": req.body.friends.id,
      });

      console.log(friendResult);

      if (friendResult) {
        console.log("inside friendresult");

        model3
          .find({ "friends.messages": { $exists: true } })
          .then((result) => {
            console.log(result);
            result.forEach((document) => {
              document.friends.forEach((friend) => {
                if (friend.id === req.body.friends.id) {
                  if (!Array.isArray(friend.messages)) {
                    friend.messages = [];
                  }
                  friend.messages.push({
                    text: req.body.friends.messages[0].text,
                    timestamps: new Date(),
                    sent: req.body.friends.messages[0].sent,
                  });
                }
              });
              document
                .save()
                .catch((err) => {
                  console.error("Error saving document:", err);
                });
            });
            res.send(req.body.friends.messages[0]);
          })
          .catch((err) => {
            console.log(err);
          });
      }
    } else {
      const data = new model3(req.body);
      data
        .save()
        .then((result) => {
          res.send(req.body.friends.messages[0]);
          console.log("data created");
          console.log(result);
        })
        .catch((err) => {
          console.log(err);
        });
      console.log("No data");
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/message/get-messages", async (req, res) => {
  const { sender_id, friend_id } = req.body;
  console.log(sender_id,friend_id);

  try {
    const document = await model3.findOne({
      sender_id: sender_id,
      "friends.id": friend_id,
    });

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    const messages = document.friends.find((friend) => friend.id === friend_id)?.messages || [];
    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.listen(3001, () => {
  console.log("listening on port 3001");
});
