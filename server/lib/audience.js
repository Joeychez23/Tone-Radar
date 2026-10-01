// Who the message is for and how it is sent. Descriptions go into Jev's state
// so judgments such as "fit" can account for the relationship.

const AUDIENCES = {
  manager: "the sender's manager",
  peer: "a peer or colleague at the same level",
  report: "someone who reports to the sender",
  executive: "a senior executive",
  customer: "a customer or client",
  vendor: "a vendor or partner company",
  team: "the sender's whole team",
  friend: "a friendly teammate the sender knows well",
};

const CHANNELS = {
  email: "work email",
  chat: "a chat message in Slack or Teams",
  text: "a text message",
  review: "a code review or document comment",
};

function describeAudience(id) {
  return AUDIENCES[id] || AUDIENCES.peer;
}

function describeChannel(id) {
  return CHANNELS[id] || CHANNELS.email;
}

module.exports = { AUDIENCES, CHANNELS, describeAudience, describeChannel };
