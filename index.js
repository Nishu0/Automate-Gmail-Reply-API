const express = require("express");
const app = express();
const path = require("path");
const { authenticate } = require("@google-cloud/local-auth");
const fs = require("fs").promises;
const { google } = require("googleapis");

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://mail.google.com/",
];

const labelName = "AutoReplied";

app.get("/api", async (req, res) => {
  const auth = await authenticate({
    keyfilePath: path.join(process.cwd(), "./credentials/credentials.json"),
    scopes: SCOPES,
  });
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.labels.list({
    userId: "me",
  });
  async function getUnrepliesMessages(auth) {
    console.log("Get Unreplied Messages");
    const gmail = google.gmail({ version: "v1", auth });
    const response = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
      q: "-in:chats -from:me -has:userlabels",
    });
    return response.data.messages || [];
  }

  async function addLabel(auth, message, labelId) {
    const gmail = google.gmail({ version: "v1", auth });
    await gmail.users.messages.modify({
      userId: "me",
      id: message.id,
      requestBody: {
        addLabelIds: [labelId],
        removeLabelIds: ["INBOX"],
      },
    });
  }

  async function createLabel(auth) {
    console.log("Create Label");

    const gmail = google.gmail({ version: "v1", auth });
    try {
      const response = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name: labelName,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        },
      });
      return response.data.id;
    } catch (error) {
      if (error.code === 409) {
        const response = await gmail.users.labels.list({
          userId: "me",
        });
        const label = response.data.labels.find(
          (label) => label.name === labelName
        );
        return label.id;
      } else {
        throw error;
      }
    }
  }

  async function main() {
    const labelId = await createLabel(auth);
    console.log(`Label has been created:  ${labelId}`);
    setInterval(async () => {
      const messages = await getUnrepliesMessages(auth);
      console.log(`found ${messages.length} unreplied messages`);

      for (const message of messages) {
        

        await addLabel(auth, message, labelId);
        console.log(`Added Label: ${message.id}`);
      }
    }, Math.floor(Math.random() * (100 - 45 + 1) + 45) * 1000); // Random interval between 45 and 120 seconds
  }

  main().catch(console.error);
});

app.listen(4000, () => {
  console.log(`server is running 4000`);
});
