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

  async function sendReply(auth, message) {
    console.log("Send Reply");

    const gmail = google.gmail({ version: "v1", auth });
    const res = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From"],
    });
    const subject = res.data.payload.headers.find(
      (header) => header.name === "Subject"
    ).value;
    const from = res.data.payload.headers.find(
      (header) => header.name === "From"
    ).value;
    const replyTo = from.match(/<(.*)>/)[1];
    const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
    const replyBody = `Hello, \n\nThank you for reaching out to me! I appreciate your email and the time you've taken to connect with me. I'll get back to you soon.\n\n Best, \nNisarg Thakkar`;
    const rawMessage = [
      `From: me`,
      `To: ${replyTo}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${message.id}`,
      `References: ${message.id}`,
      "",
      replyBody,
    ].join("\n");
    const encodedMessage = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });
  }

  async function main() {
    const labelId = await createLabel(auth);
    console.log(`Label has been created:  ${labelId}`);
    setInterval(async () => {
      const messages = await getUnrepliesMessages(auth);
      console.log(`found ${messages.length} unreplied messages`);

      for (const message of messages) {
        await sendReply(auth, message);
        console.log(`Sent Reply: ${message.id}`);

        await addLabel(auth, message, labelId);
        console.log(`Added Label: ${message.id}`);
      }
    }, Math.floor(Math.random() * (100 - 45 + 1) + 45) * 1000); 
    // Random interval between 45 and 120 seconds
  }

  main().catch(console.error);
});

app.listen(4000, () => {
  console.log(`server is running 4000`);
});
